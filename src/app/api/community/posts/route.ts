import { NextRequest } from "next/server";
import { z } from "zod";

import { validationJsonResponse, failJson, serverErrorJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { countByPostId, escapeIlike } from "@/lib/community/aggregate-counts";
import {
  communitySearchOrFilter,
  communitySearchRelevanceScore,
  communitySearchTokens,
  communitySearchTokensWithTypoExpansion,
} from "@/lib/community/search-query";
import { unwrapProfileEmbed } from "@/lib/community/profile-embed";
import { communityTrendingScore } from "@/lib/community/trending-score";
import { decodeFeedCursor, encodeFeedCursor } from "@/lib/community/feed-pagination";
import {
  buildViewerAffinity,
  forYouEngagementTiebreak,
  viewerPersonalizedBoost,
  type ViewerAffinity,
} from "@/lib/community/personalized-feed-score";
import { isMissingOptionalCommunityColumn } from "@/lib/community/schema-errors";
import { gestationalWeekFromLmp } from "@/lib/profile/computed";
import { communityPostImagePublicPrefix, sanitizeCommunityPostHtml } from "@/lib/community/sanitize-post-html";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SELECT_POSTS_FULL = `
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
    avatar_url
  )
`;

const SELECT_POSTS_MINIMAL = `
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
    avatar_url
  )
`;

const createSchema = z
  .object({
    title: z
      .union([z.string().max(200), z.null()])
      .optional()
      .transform((v) => {
        if (v == null || v === "") return null;
        const t = typeof v === "string" ? v.trim() : "";
        return t.length ? t : null;
      }),
    body: z.string().min(1).max(65_000),
    postKind: z.enum(["post", "question", "tip"]).optional(),
    bodyFormat: z.enum(["plain", "html"]).optional().default("plain"),
  })
  .superRefine((data, ctx) => {
    const fmt = data.bodyFormat ?? "plain";
    if (fmt === "plain" && data.body.length > 10_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Plain posts are limited to 10,000 characters.",
        path: ["body"],
      });
    }
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
    const relevanceTokens = communitySearchTokens(q);
    const searchTokens = communitySearchTokensWithTypoExpansion(q);
    const scoreTokens = relevanceTokens.length > 0 ? relevanceTokens : searchTokens;
    const limit = Math.min(Math.max(1, Number(searchParams.get("limit") ?? "15") || 15), 50);
    const offset = decodeFeedCursor(searchParams.get("cursor"));
    const sort = searchParams.get("sort") === "trending" ? "trending" : "new";
    const forYou = searchParams.get("forYou") === "1";
    const useDbRange = sort === "new" && !forYou && q.length === 0 && kind === "all";

    const searchFetchBoost = q.length > 0 ? 45 : 0;
    const fetchCap = Math.min(
      300,
      Math.max(
        forYou ? 90 : sort === "trending" ? Math.max(45, limit * 3) : limit + 5,
        offset + limit + 35 + searchFetchBoost,
      ),
    );

    let userWeekForYou: number | null = null;
    if (forYou) {
      const { data: preg } = await supabase
        .from("pregnancy_profiles")
        .select("gestational_age_weeks, lmp_date")
        .eq("user_id", uid)
        .maybeSingle();
      if (preg?.gestational_age_weeks != null) {
        userWeekForYou = Math.round(Number(preg.gestational_age_weeks));
      } else if (preg?.lmp_date) {
        userWeekForYou = gestationalWeekFromLmp(preg.lmp_date as string);
      }
    }

    let affinity: ViewerAffinity | null = null;
    if (forYou || sort === "trending") {
      const { data: affRows, error: affErr } = await supabase
        .from("community_post_likes")
        .select("community_posts(author_id, post_kind)")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(180);
      if (affErr) {
        console.warn("[community_posts] viewer affinity", affErr.message);
      } else {
        affinity = buildViewerAffinity(affRows ?? undefined);
      }
    }

    const buildQuery = (selectFragment: string, applyKindFilter: boolean) => {
      let qb = supabase
        .from("community_posts")
        .select(selectFragment)
        .eq("moderation_status", "visible")
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });

      if (applyKindFilter && kind !== "all" && (kind === "post" || kind === "question" || kind === "tip")) {
        qb = qb.eq("post_kind", kind);
      }

      if (searchTokens.length > 0) {
        qb = qb.or(communitySearchOrFilter(searchTokens));
      } else if (q.length > 0) {
        const esc = escapeIlike(q);
        qb = qb.or(`title.ilike.%${esc}%,body.ilike.%${esc}%`);
      }
      return qb;
    };

    let qb = buildQuery(SELECT_POSTS_FULL, true);
    if (useDbRange) {
      qb = qb.range(offset, offset + limit);
    } else {
      qb = qb.limit(fetchCap);
    }

    let { data: posts, error } = await qb;

    if (error && isMissingOptionalCommunityColumn(error)) {
      let q2 = buildQuery(SELECT_POSTS_MINIMAL, false);
      if (useDbRange) {
        q2 = q2.range(offset, offset + limit);
      } else {
        q2 = q2.limit(fetchCap);
      }
      const retry = await q2;
      posts = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error("community_posts list", error);
      const hint =
        process.env.NODE_ENV === "development" ? error.message : "Could not load posts.";
      return failJson(500, hint);
    }

    const rowsRaw = (posts ?? []) as unknown as Record<string, unknown>[];
    if (rowsRaw.length === 0) {
      return Response.json(
        { posts: [], hasMore: false, nextCursor: null },
        { headers: { "Cache-Control": "private, max-age=20, stale-while-revalidate=40" } },
      );
    }

    const hasMoreDb = useDbRange && rowsRaw.length > limit;
    const candidateRows = useDbRange ? rowsRaw.slice(0, limit) : rowsRaw;

    const ids = candidateRows.map((p) => p.id as string);
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

    let mapped = candidateRows.map((row: Record<string, unknown>) => {
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
        bodyFormat: typeof row.body_format === "string" && row.body_format === "html" ? "html" : "plain",
        likeCount: likesByPost[id] ?? 0,
        commentCount: commentsByPost[id] ?? 0,
        likedByMe: likedSet.has(id),
      };
    });

    if (forYou && userWeekForYou != null) {
      const wk = userWeekForYou;
      mapped = mapped.filter(
        (p) =>
          p.gestationalWeekSnapshot != null && Math.abs(p.gestationalWeekSnapshot - wk) <= 2,
      );
      mapped = [...mapped].sort((a, b) => {
        const da =
          a.gestationalWeekSnapshot != null ? Math.abs(a.gestationalWeekSnapshot - wk) : 99;
        const db =
          b.gestationalWeekSnapshot != null ? Math.abs(b.gestationalWeekSnapshot - wk) : 99;
        if (da !== db) return da - db;
        const pa = viewerPersonalizedBoost({
          authorId: a.authorId,
          postKind: a.postKind,
          affinity,
        });
        const pb = viewerPersonalizedBoost({
          authorId: b.authorId,
          postKind: b.postKind,
          affinity,
        });
        if (pb !== pa) return pb - pa;
        const ta = forYouEngagementTiebreak({
          likeCount: a.likeCount,
          commentCount: a.commentCount,
          createdAtIso: a.createdAt,
        });
        const tb = forYouEngagementTiebreak({
          likeCount: b.likeCount,
          commentCount: b.commentCount,
          createdAtIso: b.createdAt,
        });
        if (Math.abs(tb - ta) > 1e-9) return tb > ta ? 1 : -1;
        const ca = new Date(a.createdAt).getTime();
        const cb = new Date(b.createdAt).getTime();
        if (cb !== ca) return cb - ca;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });
    } else if (forYou) {
      mapped = [];
    }

    if (sort === "trending" && q.length === 0) {
      mapped = [...mapped].sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        const sa =
          communityTrendingScore({
            likeCount: a.likeCount,
            commentCount: a.commentCount,
            createdAtIso: a.createdAt,
          }) +
          viewerPersonalizedBoost({
            authorId: a.authorId,
            postKind: a.postKind,
            affinity,
          });
        const sb =
          communityTrendingScore({
            likeCount: b.likeCount,
            commentCount: b.commentCount,
            createdAtIso: b.createdAt,
          }) +
          viewerPersonalizedBoost({
            authorId: b.authorId,
            postKind: b.postKind,
            affinity,
          });
        if (Math.abs(sb - sa) > 1e-9) return sb > sa ? 1 : -1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } else if (q.length > 0) {
      mapped = [...mapped].sort((a, b) => {
        const ra = communitySearchRelevanceScore({
          title: a.title,
          body: a.body,
          bodyFormat: a.bodyFormat === "html" ? "html" : "plain",
          tokens: scoreTokens,
        });
        const rb = communitySearchRelevanceScore({
          title: b.title,
          body: b.body,
          bodyFormat: b.bodyFormat === "html" ? "html" : "plain",
          tokens: scoreTokens,
        });
        if (rb !== ra) return rb - ra;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }

    let postsOut: (typeof mapped)[number][];
    let hasMore: boolean;

    if (useDbRange) {
      postsOut = mapped;
      hasMore = hasMoreDb;
    } else {
      const window = mapped.slice(offset, offset + limit + 1);
      hasMore = window.length > limit;
      postsOut = window.slice(0, limit);
    }

    const nextCursor = hasMore ? encodeFeedCursor(offset + postsOut.length) : null;

    return Response.json(
      { posts: postsOut, hasMore, nextCursor },
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
    let body = parsed.data.body.trim();
    const postKind = parsed.data.postKind ?? "post";
    const bodyFormat = parsed.data.bodyFormat ?? "plain";

    if (bodyFormat === "html") {
      const prefix = communityPostImagePublicPrefix();
      if (!prefix) {
        return failJson(503, "Rich posts require NEXT_PUBLIC_SUPABASE_URL to be configured.");
      }
      body = sanitizeCommunityPostHtml(body, prefix);
    }

    const { error: ensureErr } = await supabase.rpc("ensure_profile_for_current_user");
    if (ensureErr) {
      console.warn("[community_posts] ensure_profile:", ensureErr.code, ensureErr.message);
    }

    const fullRow = {
      author_id: uid,
      title,
      body,
      body_format: bodyFormat,
      post_kind: postKind,
      gestational_week_snapshot: weekSnap,
      moderation_status: "visible" as const,
    };

    let inserted = await supabase.from("community_posts").insert(fullRow).select("id").single();

    const msg = inserted.error?.message ?? "";
    const missingCol =
      inserted.error &&
      (/post_kind|gestational_week_snapshot|body_format|schema cache/i.test(msg) ||
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
