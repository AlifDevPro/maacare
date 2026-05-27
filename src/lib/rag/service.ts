import { embedText } from "@/lib/gemini/embeddings";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type RagSearchHit = {
  id: string;
  score: number;
  content: string;
  title?: string;
  source?: string;
  documentId?: string;
  category?: string;
  chunkIndex?: number;
};

type SearchKnowledgeOptions = {
  limit?: number;
  categories?: string[];
  minSimilarity?: number;
  cacheTtlMs?: number;
};

type MatchRow = {
  chunk_id: string;
  document_id: string;
  content: string;
  title: string | null;
  source: string | null;
  category: string | null;
  chunk_index: number;
  similarity: number;
};

type SearchCacheEntry = {
  expiresAt: number;
  value: RagSearchHit[];
};

const searchCache = new Map<string, SearchCacheEntry>();
const SEARCH_CACHE_MAX = 600;

function buildSearchCacheKey(query: string, options?: SearchKnowledgeOptions): string {
  const categories = (options?.categories ?? [])
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join(",");
  const limit = Math.max(1, Math.min(20, options?.limit ?? 5));
  const minSimilarity = options?.minSimilarity ?? 0.05;
  return `${query.trim().toLowerCase()}|${limit}|${minSimilarity}|${categories}`;
}

function getSearchCacheTtlMs(options?: SearchKnowledgeOptions): number {
  if (typeof options?.cacheTtlMs === "number") return Math.max(0, options.cacheTtlMs);
  const env = Number.parseInt(process.env.RAG_SEARCH_CACHE_TTL_MS ?? "25000", 10);
  return Number.isFinite(env) ? Math.max(0, env) : 25_000;
}

function maybeReadCache(key: string): RagSearchHit[] | null {
  const entry = searchCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    searchCache.delete(key);
    return null;
  }
  return entry.value;
}

function writeCache(key: string, value: RagSearchHit[], ttlMs: number) {
  if (ttlMs <= 0) return;
  searchCache.set(key, { value, expiresAt: Date.now() + ttlMs });
  if (searchCache.size > SEARCH_CACHE_MAX) {
    const now = Date.now();
    for (const [k, v] of searchCache.entries()) {
      if (v.expiresAt <= now) searchCache.delete(k);
      if (searchCache.size <= SEARCH_CACHE_MAX) break;
    }
    if (searchCache.size > SEARCH_CACHE_MAX) {
      const firstKey = searchCache.keys().next().value;
      if (typeof firstKey === "string") searchCache.delete(firstKey);
    }
  }
}

export async function ingestKnowledgeChunk(input: {
  title?: string;
  content: string;
  source?: string;
  category?: string;
  metadata?: Record<string, string>;
  /** When omitted, uses `title` or "Knowledge chunk". */
  documentTitle?: string;
  userId?: string;
}): Promise<{ documentId: string; chunkId: string }> {
  const supabase = await createSupabaseServerClient();

  const docTitle =
    input.documentTitle ?? input.title ?? input.source ?? "Knowledge chunk";

  const { data: doc, error: docErr } = await supabase
    .from("rag_documents")
    .insert({
      title: docTitle,
      source: input.source ?? null,
      category: input.category ?? null,
      description: input.title ?? null,
      created_by: input.userId ?? null,
    })
    .select("id")
    .single();

  if (docErr || !doc) {
    throw new Error(docErr?.message ?? "Failed to create document");
  }

  const vector = await embedText(input.content);

  const { data: chunk, error: chunkErr } = await supabase
    .from("rag_chunks")
    .insert({
      document_id: doc.id,
      chunk_index: 0,
      title: input.title ?? null,
      content: input.content,
      source: input.source ?? null,
      metadata: input.metadata ?? {},
      embedding: vector,
    })
    .select("id")
    .single();

  if (chunkErr || !chunk) {
    throw new Error(chunkErr?.message ?? "Failed to create chunk");
  }

  return { documentId: doc.id, chunkId: chunk.id };
}

/** Ingest multiple chunks under one document (admin bulk upload). */
export async function ingestDocumentWithChunks(input: {
  documentTitle: string;
  source?: string;
  category?: string;
  chunks: string[];
  userId?: string;
  chunkTitles?: (string | undefined)[];
}): Promise<{ documentId: string; chunkIds: string[] }> {
  const supabase = await createSupabaseServerClient();

  const { data: doc, error: docErr } = await supabase
    .from("rag_documents")
    .insert({
      title: input.documentTitle,
      source: input.source ?? null,
      category: input.category ?? null,
      created_by: input.userId ?? null,
    })
    .select("id")
    .single();

  if (docErr || !doc) {
    throw new Error(docErr?.message ?? "Failed to create document");
  }

  const chunkIds: string[] = [];
  let chunkIndex = 0;

  for (let i = 0; i < input.chunks.length; i++) {
    const content = input.chunks[i]!.trim();
    if (!content) continue;

    const vector = await embedText(content);
    const title = input.chunkTitles?.[i];

    const { data: chunk, error: chunkErr } = await supabase
      .from("rag_chunks")
      .insert({
        document_id: doc.id,
        chunk_index: chunkIndex,
        title: title ?? null,
        content,
        source: input.source ?? null,
        metadata: {},
        embedding: vector,
      })
      .select("id")
      .single();

    if (chunkErr || !chunk) {
      throw new Error(chunkErr?.message ?? "Failed to create chunk");
    }

    chunkIds.push(chunk.id);
    chunkIndex += 1;
  }

  return { documentId: doc.id, chunkIds };
}

export async function searchKnowledge(
  query: string,
  options?: SearchKnowledgeOptions,
): Promise<RagSearchHit[]> {
  const cacheKey = buildSearchCacheKey(query, options);
  const cacheTtlMs = getSearchCacheTtlMs(options);
  const cached = maybeReadCache(cacheKey);
  if (cached) return cached;
  const supabase = await createSupabaseServerClient();
  const vector = await embedText(query);
  const limit = Math.max(1, Math.min(20, options?.limit ?? 5));
  const categories = (options?.categories ?? [])
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  const minSimilarity = options?.minSimilarity ?? 0.05;

  const { data, error } = await supabase.rpc("match_rag_chunks_for_user", {
    query_embedding: vector,
    match_count: limit,
    min_similarity: minSimilarity,
    filter_categories: categories.length > 0 ? categories : null,
  });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as MatchRow[];

  const hits = rows.map((r) => ({
    id: r.chunk_id,
    score: r.similarity,
    content: r.content,
    title: r.title ?? undefined,
    source: r.source ?? undefined,
    documentId: r.document_id,
    category: r.category ?? undefined,
    chunkIndex: r.chunk_index,
  }));
  writeCache(cacheKey, hits, cacheTtlMs);
  return hits;
}
