import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { validationJsonResponse, failJson, serverErrorJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { unwrapProfileEmbed } from "@/lib/community/profile-embed";
import { isMissingOptionalCommunityColumn } from "@/lib/community/schema-errors";
import { communityPostImagePublicPrefix, sanitizeCommunityPostHtml } from "@/lib/community/sanitize-post-html";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();

const patchPostSchema = z
  .object({
    title: z.union([z.string().max(200), z.null()]).optional(),
    body: z.string().min(1).max(65_000).optional(),
    postKind: z.enum(["post", "question", "tip"]).optional(),
    bodyFormat: z.enum(["plain", "html"]).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.body !== undefined) {
      const fmt = data.bodyFormat ?? "plain";
      if (fmt === "plain" && data.body.length > 10_000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Plain posts are limited to 10,000 characters.",
          path: ["body"],
        });
      }
    }
  });

const SELECT_DETAIL_FULL = `
  id,
  title,
  body,
  body_format,
  post_kind,
  gestational_week_snapshot,
  created_at,
  updated_at,
  author_id,
  is_pinned,
  moderation_status,
  profiles!author_id (
    display_name,
    role,
    avatar_url,
    profession,
    verified_professional
  )
`;

const SELECT_DETAIL_MINIMAL = `
  id,
  title,
  body,
  body_format,
  created_at,
  updated_at,
  author_id,
  is_pinned,
  moderation_status,
  profiles!author_id (
    display_name,
    role,
    avatar_url,
    profession,
    verified_professional
  )
`;

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ postId: string }> },
) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in to view this post.");

    const parsedId = uuid.safeParse((await context.params).postId);
    if (!parsedId.success) return failJson(400, "Invalid post.");

    const supabase = await createSupabaseServerClient();
    const uid = session.id;
    const postId = parsedId.data;

    const fullRes = await supabase
      .from("community_posts")
      .select(SELECT_DETAIL_FULL)
      .eq("id", postId)
      .maybeSingle();

    let error = fullRes.error;
    let row: Record<string, unknown> | null =
      (fullRes.data ?? null) as Record<string, unknown> | null;

    if (error && isMissingOptionalCommunityColumn(error)) {
      const minRes = await supabase
        .from("community_posts")
        .select(SELECT_DETAIL_MINIMAL)
        .eq("id", postId)
        .maybeSingle();
      row = (minRes.data ?? null) as Record<string, unknown> | null;
      error = minRes.error;
    }

    if (error) {
      console.error("community_post get", error);
      const hint =
        process.env.NODE_ENV === "development" ? error.message : "Could not load post.";
      return failJson(500, hint);
    }

    if (!row) return failJson(404, "Post not found.");

    const [likeCntRes, commentCntRes, myLikeRes] = await Promise.all([
      supabase
        .from("community_post_likes")
        .select("*", { count: "exact", head: true })
        .eq("post_id", postId),
      supabase
        .from("community_comments")
        .select("*", { count: "exact", head: true })
        .eq("post_id", postId)
        .eq("moderation_status", "visible"),
      supabase
        .from("community_post_likes")
        .select("post_id")
        .eq("post_id", postId)
        .eq("user_id", uid)
        .maybeSingle(),
    ]);

    if (likeCntRes.error) {
      console.warn("[community_post] like count:", likeCntRes.error.message);
    }
    if (commentCntRes.error) {
      console.warn("[community_post] comment count:", commentCntRes.error.message);
    }

    const likeCount = likeCntRes.error ? 0 : (likeCntRes.count ?? 0);
    const commentCount = commentCntRes.error ? 0 : (commentCntRes.count ?? 0);
    const myLike = myLikeRes.error ? null : myLikeRes.data;

    const profile = unwrapProfileEmbed(row.profiles);

    return Response.json({
      post: {
        id: row.id as string,
        title: row.title as string | null,
        body: row.body as string,
        bodyFormat: typeof row.body_format === "string" && row.body_format === "html" ? "html" : "plain",
        postKind: typeof row.post_kind === "string" ? row.post_kind : "post",
        gestationalWeekSnapshot:
          typeof row.gestational_week_snapshot === "number"
            ? row.gestational_week_snapshot
            : null,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
        authorId: row.author_id as string,
        isPinned: row.is_pinned as boolean,
        authorDisplayName: profile?.display_name ?? "Member",
        authorRole: profile?.role ?? "user",
        authorAvatarUrl: profile?.avatar_url ?? null,
        authorProfession: profile?.profession ?? null,
        authorVerifiedProfessional: profile?.verified_professional === true,
        likeCount,
        commentCount,
        likedByMe: !!myLike,
      },
    });
  } catch (e) {
    return serverErrorJson("community_post GET", e);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ postId: string }> },
) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in to edit.");

    const parsedId = uuid.safeParse((await context.params).postId);
    if (!parsedId.success) return failJson(400, "Invalid post.");

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return failJson(400, "Invalid JSON.");
    }

    const parsed = patchPostSchema.safeParse(json);
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const supabase = await createSupabaseServerClient();
    const postId = parsedId.data;

    const updates: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) {
      updates.title = parsed.data.title === null ? null : parsed.data.title.trim() || null;
    }
    if (parsed.data.body !== undefined) {
      const fmt = parsed.data.bodyFormat ?? "plain";
      let b = parsed.data.body.trim();
      if (fmt === "html") {
        const prefix = communityPostImagePublicPrefix();
        if (!prefix) {
          return failJson(503, "Rich posts require NEXT_PUBLIC_SUPABASE_URL to be configured.");
        }
        b = sanitizeCommunityPostHtml(b, prefix);
      }
      updates.body = b;
    }
    if (parsed.data.bodyFormat !== undefined) {
      updates.body_format = parsed.data.bodyFormat;
    }
    if (parsed.data.postKind !== undefined) updates.post_kind = parsed.data.postKind;

    if (Object.keys(updates).length === 0) {
      return failJson(400, "Nothing to update.");
    }

    const { data: updated, error } = await supabase
      .from("community_posts")
      .update(updates)
      .eq("id", postId)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("community_post PATCH", error);
      const hint =
        process.env.NODE_ENV === "development" ? error.message : "Could not update post.";
      return failJson(500, hint);
    }

    if (!updated) {
      return failJson(403, "You can only edit your own posts.");
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverErrorJson("community_post PATCH", e);
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ postId: string }> },
) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in to delete.");

    const parsedId = uuid.safeParse((await context.params).postId);
    if (!parsedId.success) return failJson(400, "Invalid post.");

    const supabase = await createSupabaseServerClient();
    const postId = parsedId.data;

    const { data: deleted, error } = await supabase
      .from("community_posts")
      .delete()
      .eq("id", postId)
      .select("id");

    if (error) {
      console.error("community_post DELETE", error);
      const hint =
        process.env.NODE_ENV === "development" ? error.message : "Could not delete post.";
      return failJson(500, hint);
    }

    if (!deleted?.length) {
      return failJson(403, "You can only delete your own posts.");
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverErrorJson("community_post DELETE", e);
  }
}
