import { NextRequest } from "next/server";
import { z } from "zod";

import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { gestationalWeekFromLmp } from "@/lib/profile/computed";
import { htmlToPlainText, trimPlainPreview } from "@/lib/community/html-to-plain-text";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();

function kindLabel(kind: string): string {
  if (kind === "question") return "Question";
  if (kind === "tip") return "Tip";
  return "Post";
}

function bodyPreviewPlain(body: string, bodyFormat: "plain" | "html"): string {
  const full = bodyFormat === "html" ? htmlToPlainText(body) : body.replace(/\s+/g, " ").trim();
  return trimPlainPreview(full, 200);
}

type ActivityItem = {
  kind: "post" | "comment";
  id: string;
  createdAt: string;
  body: string;
  bodyPreviewPlain: string;
  title: string | null;
  postId: string;
  postTitle: string | null;
  postKind: string | null;
  summary: string;
  verb: "published" | "commented";
};

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in to view profiles.");

    const parsedId = uuid.safeParse((await context.params).userId);
    if (!parsedId.success) return failJson(400, "Invalid profile.");

    const supabase = await createSupabaseServerClient();
    const uid = parsedId.data;
    const viewerId = session.id;
    const isSelf = viewerId === uid;

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select(
        "id, display_name, avatar_url, role, created_at, profession, language, community_show_extended_profile, verified_professional",
      )
      .eq("id", uid)
      .maybeSingle();

    if (pErr) {
      console.error("[community/member GET] profile", pErr);
      return failJson(500, "Could not load profile.");
    }
    if (!profile) {
      return failJson(404, "Member not found or not visible in community.");
    }

    const showExtended =
      isSelf || profile.community_show_extended_profile === true;

    let pregnancyPublic: {
      gestationalWeek: number | null;
      eddDate: string | null;
      pregnancyStatus: string | null;
    } | null = null;

    if (showExtended) {
      const { data: preg } = await supabase
        .from("pregnancy_profiles")
        .select("gestational_age_weeks, lmp_date, edd_date, pregnancy_status")
        .eq("user_id", uid)
        .maybeSingle();

      if (preg && (isSelf || profile.community_show_extended_profile === true)) {
        let week: number | null =
          preg.gestational_age_weeks != null ? Math.round(Number(preg.gestational_age_weeks)) : null;
        if (week == null && preg.lmp_date) {
          week = gestationalWeekFromLmp(preg.lmp_date as string);
        }
        pregnancyPublic = {
          gestationalWeek: week,
          eddDate: (preg.edd_date as string | null) ?? null,
          pregnancyStatus: (preg.pregnancy_status as string | null) ?? null,
        };
      }
    }

    const { data: postRows, error: postsErr } = await supabase
      .from("community_posts")
      .select("id, title, body, body_format, post_kind, gestational_week_snapshot, created_at")
      .eq("author_id", uid)
      .eq("moderation_status", "visible")
      .order("created_at", { ascending: false })
      .limit(24);

    if (postsErr) {
      console.error("[community/member GET] posts", postsErr);
      return failJson(500, "Could not load posts.");
    }

    const posts = (postRows ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      title: r.title as string | null,
      body: r.body as string,
      bodyFormat: typeof r.body_format === "string" && r.body_format === "html" ? "html" : "plain",
      postKind: typeof r.post_kind === "string" ? r.post_kind : "post",
      gestationalWeekSnapshot:
        typeof r.gestational_week_snapshot === "number" ? r.gestational_week_snapshot : null,
      createdAt: r.created_at as string,
    }));

    const { data: commentRows, error: cErr } = await supabase
      .from("community_comments")
      .select("id, body, created_at, post_id")
      .eq("author_id", uid)
      .eq("moderation_status", "visible")
      .order("created_at", { ascending: false })
      .limit(25);

    if (cErr) {
      console.warn("[community/member GET] comments activity", cErr.message);
    }

    const commentRowsSafe = (commentRows ?? []) as { id: string; body: string; created_at: string; post_id: string }[];
    const postIdsForComments = [...new Set(commentRowsSafe.map((c) => c.post_id))];
    const visiblePostMeta = new Map<string, { title: string | null }>();
    if (postIdsForComments.length > 0) {
      const { data: visPosts } = await supabase
        .from("community_posts")
        .select("id, title")
        .in("id", postIdsForComments)
        .eq("moderation_status", "visible");
      for (const p of visPosts ?? []) {
        visiblePostMeta.set(p.id as string, { title: (p.title as string | null) ?? null });
      }
    }

    const commentActivity: ActivityItem[] = [];
    for (const row of commentRowsSafe) {
      const meta = visiblePostMeta.get(row.post_id);
      if (!meta) continue;
      const postTitle = meta.title;
      const postTitlePlain = postTitle ? trimPlainPreview(postTitle.replace(/\s+/g, " ").trim(), 120) : null;
      const preview = bodyPreviewPlain(row.body, "plain");
      const summary = postTitlePlain
        ? `Commented on “${postTitlePlain}”`
        : "Commented on a thread";
      commentActivity.push({
        kind: "comment",
        id: row.id,
        createdAt: row.created_at,
        body: row.body,
        bodyPreviewPlain: preview,
        title: null,
        postId: row.post_id,
        postTitle,
        postKind: null,
        summary,
        verb: "commented",
      });
    }

    const postActivity: ActivityItem[] = posts.map((p) => {
      const fmt = p.bodyFormat === "html" ? "html" : "plain";
      const preview = bodyPreviewPlain(p.body, fmt);
      const titlePart = p.title?.trim() ? ` — ${trimPlainPreview(p.title.trim(), 72)}` : "";
      const summary = `Published · ${kindLabel(p.postKind)}${titlePart}`;
      return {
        kind: "post" as const,
        id: p.id,
        createdAt: p.createdAt,
        body: p.body,
        bodyPreviewPlain: preview,
        title: p.title,
        postId: p.id,
        postTitle: p.title,
        postKind: p.postKind,
        summary,
        verb: "published" as const,
      };
    });

    const activity = [...postActivity, ...commentActivity]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 30);

    const [{ count: postCountExact }, { count: commentCountExact }] = await Promise.all([
      supabase
        .from("community_posts")
        .select("id", { count: "exact", head: true })
        .eq("author_id", uid)
        .eq("moderation_status", "visible"),
      supabase
        .from("community_comments")
        .select("id", { count: "exact", head: true })
        .eq("author_id", uid)
        .eq("moderation_status", "visible"),
    ]);

    const postCount = typeof postCountExact === "number" ? postCountExact : posts.length;
    const commentCount = typeof commentCountExact === "number" ? commentCountExact : commentRowsSafe.length;

    const professionLabel =
      profile.profession === "clinician"
        ? "Clinician"
        : profile.profession === "parent_caregiver"
          ? "Parent / caregiver"
          : profile.profession === "other"
            ? "Other"
            : profile.profession
              ? String(profile.profession)
              : null;

    const lang = (profile.language as string | null) ?? "en";
    const languageLabel = lang === "bn" ? "Bengali" : "English";

    return Response.json({
      profile: {
        id: profile.id as string,
        displayName: profile.display_name as string,
        avatarUrl: (profile.avatar_url as string | null) ?? null,
        role: profile.role as string,
        memberSince: profile.created_at as string,
        profession: (profile.profession as string | null) ?? null,
        professionLabel,
        language: lang,
        languageLabel,
        communityShowExtendedProfile: profile.community_show_extended_profile === true,
        verifiedProfessional: profile.verified_professional === true,
        showExtendedToViewer: showExtended,
        pregnancy: pregnancyPublic,
        postCount,
        commentCount,
      },
      posts,
      activity,
    });
  } catch (e) {
    return serverErrorJson("community_member GET", e);
  }
}
