import { NextRequest } from "next/server";
import { z } from "zod";

import { validationJsonResponse, failJson, serverErrorJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { unwrapProfileEmbed } from "@/lib/community/profile-embed";
import { dispatchPushNow } from "@/lib/push/dispatch-now";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();

const commentSchema = z.object({
  body: z.string().min(1).max(5000),
  parentCommentId: z.string().uuid().optional().nullable(),
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ postId: string }> },
) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in to view replies.");

    const parsedId = uuid.safeParse((await context.params).postId);
    if (!parsedId.success) return failJson(400, "Invalid post.");

    const supabase = await createSupabaseServerClient();
    const postId = parsedId.data;

    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "50") || 50, 100);

    const { data: rows, error } = await supabase
      .from("community_comments")
      .select(
        `
        id,
        body,
        created_at,
        parent_comment_id,
        author_id,
        moderation_status,
        profiles!author_id (
          display_name,
          role,
          avatar_url,
          profession,
          verified_professional
        )
      `,
      )
      .eq("post_id", postId)
      .eq("moderation_status", "visible")
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) {
      console.error("comments list", error);
      return failJson(500, "Could not load replies.");
    }

    const comments = (rows ?? []).map((row: Record<string, unknown>) => {
      const profile = unwrapProfileEmbed(row.profiles);
      return {
        id: row.id as string,
        body: row.body as string,
        createdAt: row.created_at as string,
        parentCommentId: (row.parent_comment_id as string | null) ?? null,
        authorId: row.author_id as string,
        authorDisplayName: profile?.display_name ?? "Member",
        authorRole: profile?.role ?? "user",
        authorAvatarUrl: profile?.avatar_url ?? null,
        authorProfession: profile?.profession ?? null,
        authorVerifiedProfessional: profile?.verified_professional === true,
      };
    });

    return Response.json({ comments });
  } catch (e) {
    return serverErrorJson("community_comments GET", e);
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ postId: string }> },
) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in to reply.");

    const parsedId = uuid.safeParse((await context.params).postId);
    if (!parsedId.success) return failJson(400, "Invalid post.");

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return failJson(400, "Invalid JSON.");
    }

    const parsed = commentSchema.safeParse(json);
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const supabase = await createSupabaseServerClient();
    const uid = session.id;
    const postId = parsedId.data;
    const parentCommentId = parsed.data.parentCommentId ?? null;

    if (parentCommentId) {
      const { data: parentRow, error: parentErr } = await supabase
        .from("community_comments")
        .select("id")
        .eq("id", parentCommentId)
        .eq("post_id", postId)
        .eq("moderation_status", "visible")
        .maybeSingle();
      if (parentErr || !parentRow) {
        return failJson(400, "Invalid parent comment.");
      }
    }

    const { error: ensureErr } = await supabase.rpc("ensure_profile_for_current_user");
    if (ensureErr) {
      console.warn("[community_comments] ensure_profile:", ensureErr.message);
    }

    const { error } = await supabase.from("community_comments").insert({
      post_id: postId,
      parent_comment_id: parentCommentId,
      author_id: uid,
      body: parsed.data.body.trim(),
      moderation_status: "visible",
    });

    if (error) {
      console.error("comment insert", error);
      const hint =
        process.env.NODE_ENV === "development" ? error.message : "Could not post reply.";
      return failJson(500, hint);
    }

    await dispatchPushNow();

    return Response.json({ ok: true });
  } catch (e) {
    return serverErrorJson("community_comments POST", e);
  }
}
