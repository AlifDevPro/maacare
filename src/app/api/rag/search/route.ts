import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionFromCookies } from "@/lib/auth/get-session";
import { searchKnowledge } from "@/lib/rag/service";

const bodySchema = z.object({
  query: z.string().min(1).max(4000),
  limit: z.number().int().min(1).max(20).optional(),
  categories: z.array(z.string().min(1).max(120)).max(10).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { query, limit, categories } = bodySchema.parse(await req.json());
    const hits = await searchKnowledge(query, {
      limit: limit ?? 5,
      categories,
    });

    return NextResponse.json({ hits });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error(err);
    const message = err instanceof Error ? err.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
