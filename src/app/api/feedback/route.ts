import { NextRequest } from "next/server";
import { z } from "zod";

import { validationJsonResponse, failJson, serverErrorJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  kind: z.enum(["error", "feedback", "navigation"]),
  message: z.string().min(1).max(8000),
  context: z.record(z.unknown()).optional(),
});

const MAX_PER_HOUR = 20;

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in to send feedback.");

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return failJson(400, "Invalid JSON.");
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const supabase = await createSupabaseServerClient();
    const uid = session.id;
    const since = new Date(Date.now() - 3_600_000).toISOString();

    const { count, error: cErr } = await supabase
      .from("app_feedback")
      .select("*", { count: "exact", head: true })
      .eq("user_id", uid)
      .gte("created_at", since);

    if (cErr) {
      console.warn("[feedback POST] count", cErr.message);
    } else if ((count ?? 0) >= MAX_PER_HOUR) {
      return failJson(429, "Too many reports this hour. Try again later.");
    }

    const ctx = {
      ...(parsed.data.context ?? {}),
      path: req.headers.get("referer") ?? req.nextUrl.pathname,
      userAgent: req.headers.get("user-agent") ?? undefined,
    };

    const { error } = await supabase.from("app_feedback").insert({
      user_id: uid,
      kind: parsed.data.kind,
      message: parsed.data.message.trim(),
      context: ctx,
      status: "new",
    });

    if (error) {
      console.error("[feedback POST]", error);
      return failJson(500, "Could not save feedback.");
    }

    return Response.json({ ok: true });
  } catch (e) {
    return serverErrorJson("feedback POST", e);
  }
}
