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

  for (let i = 0; i < input.chunks.length; i++) {
    const content = input.chunks[i]!.trim();
    if (!content) continue;

    const vector = await embedText(content);
    const title = input.chunkTitles?.[i];

    const { data: chunk, error: chunkErr } = await supabase
      .from("rag_chunks")
      .insert({
        document_id: doc.id,
        chunk_index: i,
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
  }

  return { documentId: doc.id, chunkIds };
}

export async function searchKnowledge(query: string, limit = 5): Promise<RagSearchHit[]> {
  const supabase = await createSupabaseServerClient();
  const vector = await embedText(query);

  const { data, error } = await supabase.rpc("match_rag_chunks_for_user", {
    query_embedding: vector,
    match_count: limit,
    min_similarity: 0.05,
  });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as MatchRow[];

  return rows.map((r) => ({
    id: r.chunk_id,
    score: r.similarity,
    content: r.content,
    title: r.title ?? undefined,
    source: r.source ?? undefined,
    documentId: r.document_id,
    category: r.category ?? undefined,
    chunkIndex: r.chunk_index,
  }));
}
