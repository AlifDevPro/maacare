import { NextRequest } from "next/server";
import { z } from "zod";

import { failJson, serverErrorJson, validationJsonResponse } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const postSchema = z.object({
  context: z.enum(["postpartum", "general"]).default("postpartum"),
  moodKey: z.string().min(1).max(40),
  note: z.string().max(500).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "14") || 14, 30);
    const ctxFilter = req.nextUrl.searchParams.get("context");
    const supabase = await createSupabaseServerClient();

    let q = supabase
      .from("wellbeing_check_ins")
      .select("id, context, mood_key, note, logged_at")
      .eq("user_id", session.id)
      .order("logged_at", { ascending: false })
      .limit(limit);

    if (ctxFilter === "postpartum" || ctxFilter === "general") {
      q = q.eq("context", ctxFilter);
    }

    const { data, error } = await q;
    if (error) {
      console.error("[wellbeing/check-in] list:", error);
      return failJson(500, "Could not load check-ins.");
    }

    return Response.json({
      items: (data ?? []).map((r) => ({
        id: r.id as string,
        context: r.context as string,
        moodKey: r.mood_key as string,
        note: (r.note as string | null) ?? null,
        loggedAt: r.logged_at as string,
      })),
    });
  } catch (e) {
    return serverErrorJson("wellbeing_check_in GET", e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return failJson(400, "Invalid JSON.");
    }

    const parsed = postSchema.safeParse(json);
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("wellbeing_check_ins")
      .insert({
        user_id: session.id,
        context: parsed.data.context,
        mood_key: parsed.data.moodKey,
        note: parsed.data.note?.trim() || null,
      })
      .select("id, context, mood_key, note, logged_at")
      .single();

    if (error || !data) {
      console.error("[wellbeing/check-in] insert:", error);
      return failJson(500, "Could not save check-in.");
    }

    return Response.json({
      item: {
        id: data.id as string,
        context: data.context as string,
        moodKey: data.mood_key as string,
        note: (data.note as string | null) ?? null,
        loggedAt: data.logged_at as string,
      },
    });
  } catch (e) {
    return serverErrorJson("wellbeing_check_in POST", e);
  }
}
