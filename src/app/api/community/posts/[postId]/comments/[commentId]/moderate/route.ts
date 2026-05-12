import { NextRequest } from "next/server";
import { z } from "zod";

import { validationJsonResponse, failJson, serverErrorJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();

const bodySchema = z.object({
  status: z.enum(["visible", "hidden", "pending"]),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ postId: string; commentId: string }> },
) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in to moderate.");

    const { postId: rawPostId, commentId: rawCommentId } = await context.params;
    const postId = uuid.safeParse(rawPostId);
    const commentId = uuid.safeParse(rawCommentId);
    if (!postId.success || !commentId.success) return failJson(400, "Invalid id.");

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return failJson(400, "Invalid JSON.");
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const supabase = await createSupabaseServerClient();
    const { data: row } = await supabase
      .from("community_comments")
      .select("id")
      .eq("id", commentId.data)
      .eq("post_id", postId.data)
      .maybeSingle();

    if (!row) return failJson(404, "Comment not found.");

    const { data, error } = await supabase.rpc("community_set_comment_moderation_status", {
      p_comment_id: commentId.data,
      p_status: parsed.data.status,
    });

    if (error) {
      console.error("[community/comment moderate]", error);
      const msg = error.message.toLowerCase();
      if (msg.includes("forbidden")) return failJson(403, "Moderator access required.");
      return failJson(500, "Could not update comment.");
    }

    if (data !== true) {
      return failJson(404, "Comment not found.");
    }

    return Response.json({ ok: true });
  } catch (e) {
    return serverErrorJson("community_comment moderate POST", e);
  }
}
