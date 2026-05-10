import { NextRequest } from "next/server";
import { z } from "zod";

import { validationJsonResponse, failJson, serverErrorJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { countByPostId, escapeIlike } from "@/lib/community/aggregate-counts";
import { unwrapProfileEmbed } from "@/lib/community/profile-embed";
import { isMissingOptionalCommunityColumn } from "@/lib/community/schema-errors";
import { gestationalWeekFromLmp } from "@/lib/profile/computed";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SELECT_POSTS_FULL = `
  id,
  title,
  body,
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
    avatar_url
  )
`;

const SELECT_POSTS_MINIMAL = `
  id,
  title,
  body,
  created_at,
  updated_at,
  author_id,
  is_pinned,
  moderation_status,
  profiles!author_id (
    display_name,
    role,
    avatar_url
  )
`;

const createSchema = z.object({
  title: z
    .union([z.string().max(200), z.null()])
    .optional()
    .transform((v) => {
      if (v == null || v === "") return null;
      const t = typeof v === "string" ? v.trim() : "";
      return t.length ? t : null;
    }),
  body: z.string().min(1).max(10_000),
  postKind: z.enum(["post", "question", "tip"]).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in to view community.");

    const supabase = await createSupabaseServerClient();
    const uid = session.id;

    const { searchParams } = req.nextUrl;
    const kind = searchParams.get("kind") ?? "all";
    const q = searchParams.get("q")?.trim() ?? "";
    const limit = Math.min(Number(searchParams.get("limit") ?? "30") || 30, 50);

    const buildQuery = (selectFragment: string, applyKindFilter: boolean) => {
      let qb = supabase
        .from("community_posts")
        .select(selectFragment)
        .eq("moderation_status", "visible")
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit);

      if (applyKindFilter && kind !== "all" && (kind === "post" || kind === "question" || kind === "tip")) {
        qb = qb.eq("post_kind", kind);
      }

      if (q.length > 0) {
        const esc = escapeIlike(q);
        qb = qb.or(`title.ilike.%${esc}%,body.ilike.%${esc}%`);
      }
      return qb;
    };

    let { data: posts, error } = await buildQuery(SELECT_POSTS_FULL, true);

    if (error && isMissingOptionalCommunityColumn(error)) {
      const retry = await buildQuery(SELECT_POSTS_MINIMAL, false);
      posts = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error("community_posts list", error);
      const hint =
        process.env.NODE_ENV === "development" ? error.message : "Could not load posts.";
      return failJson(500, hint);
    }

    const rows = (posts ?? []) as unknown as Record<string, unknown>[];
    const ids = rows.map((p) => p.id as string);
    if (ids.length === 0) {
      return Response.json(
        { posts: [] },
        { headers: { "Cache-Control": "private, max-age=20, stale-while-revalidate=40" } },
      );
    }

    const [likeRes, commentRes, myLikeRes] = await Promise.all([
      supabase.from("community_post_likes").select("post_id").in("post_id", ids),
      supabase
        .from("community_comments")
        .select("post_id")
        .in("post_id", ids)
        .eq("moderation_status", "visible"),
      supabase.from("community_post_likes").select("post_id").eq("user_id", uid).in("post_id", ids),
    ]);

    if (likeRes.error) {
      console.warn("[community_posts] likes aggregate:", likeRes.error.message);
    }
    if (commentRes.error) {
      console.warn("[community_posts] comment counts:", commentRes.error.message);
    }
    if (myLikeRes.error) {
      console.warn("[community_posts] my likes:", myLikeRes.error.message);
    }

    const likesByPost = countByPostId(
      likeRes.error ? null : (likeRes.data as { post_id: string }[] | null),
    );
    const commentsByPost = countByPostId(
      commentRes.error ? null : (commentRes.data as { post_id: string }[] | null),
    );
    const likedSet = new Set(
      myLikeRes.error
        ? []
        : (myLikeRes.data ?? []).map((r: { post_id: string }) => r.post_id),
    );

    const mapped = rows.map((row: Record<string, unknown>) => {
      const profile = unwrapProfileEmbed(row.profiles);
      const id = row.id as string;
      return {
        id,
        title: row.title as string | null,
        body: row.body as string,
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
        likeCount: likesByPost[id] ?? 0,
        commentCount: commentsByPost[id] ?? 0,
        likedByMe: likedSet.has(id),
      };
    });

    return Response.json(
      { posts: mapped },
      { headers: { "Cache-Control": "private, max-age=20, stale-while-revalidate=40" } },
    );
  } catch (e) {
    return serverErrorJson("community_posts GET", e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in to create a post.");

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return failJson(400, "Invalid JSON.");
    }

    const parsed = createSchema.safeParse(json);
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const supabase = await createSupabaseServerClient();
    const uid = session.id;

    const { data: preg } = await supabase
      .from("pregnancy_profiles")
      .select("lmp_date, gestational_age_weeks")
      .eq("user_id", uid)
      .maybeSingle();

    let weekSnap: number | null = null;
    if (preg?.gestational_age_weeks != null) {
      weekSnap = Math.round(Number(preg.gestational_age_weeks));
    } else if (preg?.lmp_date) {
      const w = gestationalWeekFromLmp(preg.lmp_date);
      weekSnap = w ?? null;
    }

    const title = parsed.data.title?.trim() || null;
    const body = parsed.data.body.trim();
    const postKind = parsed.data.postKind ?? "post";

    const { error: ensureErr } = await supabase.rpc("ensure_profile_for_current_user");
    if (ensureErr) {
      console.warn("[community_posts] ensure_profile:", ensureErr.code, ensureErr.message);
    }

    const fullRow = {
      author_id: uid,
      title,
      body,
      post_kind: postKind,
      gestational_week_snapshot: weekSnap,
      moderation_status: "visible" as const,
    };

    let inserted = await supabase.from("community_posts").insert(fullRow).select("id").single();

    const msg = inserted.error?.message ?? "";
    const missingCol =
      inserted.error &&
      (/post_kind|gestational_week_snapshot|schema cache/i.test(msg) ||
        inserted.error.code === "42703");

    if (inserted.error && missingCol) {
      inserted = await supabase
        .from("community_posts")
        .insert({
          author_id: uid,
          title,
          body,
          moderation_status: "visible",
        })
        .select("id")
        .single();
    }

    if (inserted.error) {
      console.error("community_posts insert", inserted.error);
      const hint =
        inserted.error.code === "23503"
          ? "Your account profile is not ready. Try signing out and back in, or contact support."
          : process.env.NODE_ENV === "development"
            ? inserted.error.message
            : "Could not publish post.";
      return failJson(500, hint);
    }

    return Response.json({ id: inserted.data?.id });
  } catch (e) {
    return serverErrorJson("community_posts POST", e);
  }
}
