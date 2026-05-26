import { NextRequest } from "next/server";
import { z } from "zod";

import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { dispatchPushNow } from "@/lib/push/dispatch-now";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();
const bodySchema = z.object({ liked: z.boolean().optional() });

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ postId: string }> },
) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in to like posts.");

    const parsedId = uuid.safeParse((await context.params).postId);
    if (!parsedId.success) return failJson(400, "Invalid post.");

    const rawBody = await req.json().catch(() => ({}));
    const parsedBody = bodySchema.safeParse(rawBody);
    const desiredLiked = parsedBody.success ? parsedBody.data.liked : undefined;

    const supabase = await createSupabaseServerClient();
    const uid = session.id;
    const postId = parsedId.data;

    const { error: ensureErr } = await supabase.rpc("ensure_profile_for_current_user");
    if (ensureErr) {
      console.warn("[community_like] ensure_profile:", ensureErr.message);
    }

    const { data: existing, error: existingErr } = await supabase
      .from("community_post_likes")
      .select("post_id")
      .eq("post_id", postId)
      .eq("user_id", uid)
      .maybeSingle();

    if (existingErr) {
      console.error("[community_like] select existing:", existingErr);
      return failJson(500, "Could not update like.");
    }

    const hasLike = !!existing;
    let likedAfter: boolean;
    let didInsert = false;

    if (desiredLiked === undefined) {
      likedAfter = !hasLike;
      if (hasLike) {
        const { error: delErr } = await supabase
          .from("community_post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", uid);
        if (delErr) {
          console.error("like delete", delErr);
          return failJson(500, "Could not update like.");
        }
      } else {
        const { error: insErr } = await supabase.from("community_post_likes").insert({
          post_id: postId,
          user_id: uid,
        });
        if (insErr) {
          console.error("like insert", insErr);
          const hint =
            process.env.NODE_ENV === "development" ? insErr.message : "Could not update like.";
          return failJson(500, hint);
        }
        didInsert = true;
      }
    } else {
      likedAfter = desiredLiked;
      if (desiredLiked && !hasLike) {
        const { error: insErr } = await supabase.from("community_post_likes").insert({
          post_id: postId,
          user_id: uid,
        });
        if (insErr) {
          console.error("like insert", insErr);
          const hint =
            process.env.NODE_ENV === "development" ? insErr.message : "Could not update like.";
          return failJson(500, hint);
        }
        didInsert = true;
      } else if (!desiredLiked && hasLike) {
        const { error: delErr } = await supabase
          .from("community_post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", uid);
        if (delErr) {
          console.error("like delete", delErr);
          return failJson(500, "Could not update like.");
        }
      }
    }

    const { count } = await supabase
      .from("community_post_likes")
      .select("*", { count: "exact", head: true })
      .eq("post_id", postId);

    if (didInsert) {
      void dispatchPushNow();
    }

    return Response.json({
      liked: likedAfter,
      likeCount: count ?? 0,
    });
  } catch (e) {
    return serverErrorJson("community_like POST", e);
  }
}
