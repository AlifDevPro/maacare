import { NextResponse } from "next/server";
import { z } from "zod";

import { validationJsonResponse } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteCtx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  title: z.string().min(1).max(500),
  source: z.string().max(500),
  category: z.string().max(200),
  description: z.string().max(5000),
});

export async function PATCH(req: Request, ctx: RouteCtx) {
  try {
    const session = await getSessionFromCookies();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return validationJsonResponse(parsed.error);
    }

    const supabase = await createSupabaseServerClient();

    const { data: updated, error } = await supabase
      .from("rag_documents")
      .update({
        title: parsed.data.title.trim(),
        source: parsed.data.source.trim() || null,
        category: parsed.data.category.trim() || null,
        description: parsed.data.description.trim() || null,
      })
      .eq("id", id)
      .select("id, title, source, category, description, updated_at")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!updated) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json({
      document: {
        id: updated.id,
        title: updated.title,
        source: updated.source ?? "",
        category: updated.category ?? "",
        description: updated.description ?? "",
        updated: updated.updated_at,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  try {
    const session = await getSessionFromCookies();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.from("rag_documents").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
