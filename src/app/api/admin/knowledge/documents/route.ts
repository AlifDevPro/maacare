import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionFromCookies } from "@/lib/auth/get-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { chunkText } from "@/lib/rag/chunk-text";
import { ingestDocumentWithChunks } from "@/lib/rag/service";

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = await createSupabaseServerClient();

    const { data: docs, error } = await supabase
      .from("rag_documents")
      .select("id, title, source, category, updated_at, created_at, rag_chunks(count)")
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const items =
      docs?.map((d) => {
        const rc = d.rag_chunks as unknown as { count: number }[] | null;
        const count = Array.isArray(rc) && rc[0]?.count != null ? Number(rc[0].count) : 0;
        return {
          id: d.id,
          title: d.title,
          source: d.source ?? "",
          category: d.category ?? "",
          chunks: count,
          updated: d.updated_at ?? d.created_at,
        };
      }) ?? [];

    return NextResponse.json({ documents: items });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to load documents" }, { status: 500 });
  }
}

const postSchema = z.object({
  documentTitle: z.string().min(1).max(500),
  text: z.string().min(1).max(500_000),
  source: z.string().max(500).optional(),
  category: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = postSchema.parse(await req.json());
    const chunks = chunkText(body.text);

    if (chunks.length === 0) {
      return NextResponse.json({ error: "No text chunks produced" }, { status: 400 });
    }

    const result = await ingestDocumentWithChunks({
      documentTitle: body.documentTitle,
      source: body.source,
      category: body.category,
      chunks,
      userId: session.id,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error(err);
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
