import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { failJson, serverErrorJson, validationJsonResponse } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { escapeIlike } from "@/lib/community/aggregate-counts";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  mode: z.enum(["ids", "filtered", "all"]),
  ids: z.array(z.string().uuid()).max(1000).optional(),
  q: z.string().max(200).optional(),
  category: z.string().max(200).optional(),
  password: z.string().min(1, "Password is required").max(200),
});

function createPasswordCheckClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set");
  }
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session || session.role !== "admin") return failJson(403, "Admin access required.");

    let bodyUnknown: unknown;
    try {
      bodyUnknown = await req.json();
    } catch {
      return failJson(400, "Invalid JSON body.");
    }

    const parsed = bodySchema.safeParse(bodyUnknown);
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const { mode, ids, q, category, password } = parsed.data;

    const authClient = createPasswordCheckClient();
    const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
      email: session.email.toLowerCase().trim(),
      password,
    });
    if (signInError || !signInData.user || signInData.user.id !== session.id) {
      return failJson(401, "Password confirmation failed.");
    }
    await authClient.auth.signOut();

    const supabase = await createSupabaseServerClient();

    if (mode === "ids") {
      if (!ids?.length) return failJson(400, "No documents selected.");
      const { error, count } = await supabase
        .from("rag_documents")
        .delete({ count: "exact" })
        .in("id", ids);
      if (error) return failJson(500, error.message);
      return Response.json({ ok: true, deleted: count ?? ids.length });
    }

    if (mode === "all") {
      const { error, count } = await supabase
        .from("rag_documents")
        .delete({ count: "exact" })
        .not("id", "is", null);
      if (error) return failJson(500, error.message);
      return Response.json({ ok: true, deleted: count ?? 0 });
    }

    let query = supabase.from("rag_documents").delete({ count: "exact" }).not("id", "is", null);
    const categoryValue = category?.trim() ?? "";
    const qValue = q?.trim() ?? "";

    if (categoryValue && categoryValue !== "all") {
      query = query.eq("category", categoryValue);
    }
    if (qValue) {
      const esc = escapeIlike(qValue);
      query = query.ilike("title", `%${esc}%`);
    }

    const { error, count } = await query;
    if (error) return failJson(500, error.message);
    return Response.json({ ok: true, deleted: count ?? 0 });
  } catch (e) {
    return serverErrorJson("admin/knowledge/documents/delete POST", e);
  }
}
