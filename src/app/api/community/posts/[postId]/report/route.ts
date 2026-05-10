import { z } from "zod";

import { validationJsonResponse, failJson, serverErrorJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  reason: z.enum(["spam", "abuse", "harassment", "misinformation", "other"]),
  details: z.string().max(1000).optional(),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ postId: string }> },
) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in to report posts.");

    const postId = z.string().uuid().safeParse((await context.params).postId);
    if (!postId.success) return failJson(400, "Invalid post.");

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return failJson(400, "Invalid JSON.");
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const supabase = await createSupabaseServerClient();

    const { data: post } = await supabase
      .from("community_posts")
      .select("id")
      .eq("id", postId.data)
      .maybeSingle();
    if (!post) return failJson(404, "Post not found.");

    const { data: existing } = await supabase
      .from("community_post_reports")
      .select("id")
      .eq("post_id", postId.data)
      .eq("reporter_id", session.id)
      .eq("status", "open")
      .maybeSingle();
    if (existing) return failJson(409, "You already reported this post.");

    const { error } = await supabase.from("community_post_reports").insert({
      post_id: postId.data,
      reporter_id: session.id,
      reason: parsed.data.reason,
      details: parsed.data.details?.trim() || null,
      status: "open",
    });
    if (error) {
      console.error("[community/report POST]", error);
      return failJson(500, "Could not submit report.");
    }

    return Response.json({ ok: true });
  } catch (e) {
    return serverErrorJson("community/report POST", e);
  }
}

