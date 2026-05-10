import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionFromCookies } from "@/lib/auth/get-session";
import { ingestKnowledgeChunk } from "@/lib/rag/service";

const bodySchema = z.object({
  title: z.string().max(500).optional(),
  content: z.string().min(1).max(50_000),
  source: z.string().max(500).optional(),
  category: z.string().max(200).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = bodySchema.parse(await req.json());
    const result = await ingestKnowledgeChunk({
      ...parsed,
      userId: session.id,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error(err);
    const message = err instanceof Error ? err.message : "Ingest failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
