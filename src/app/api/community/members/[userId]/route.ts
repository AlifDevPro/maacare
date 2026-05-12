import { NextRequest } from "next/server";
import { z } from "zod";

import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();

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

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, role, created_at")
      .eq("id", uid)
      .maybeSingle();

    if (pErr) {
      console.error("[community/member GET] profile", pErr);
      return failJson(500, "Could not load profile.");
    }
    if (!profile) {
      return failJson(404, "Member not found or not visible in community.");
    }

    const { data: postRows, error: postsErr } = await supabase
      .from("community_posts")
      .select("id, title, body, post_kind, gestational_week_snapshot, created_at")
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
      postKind: typeof r.post_kind === "string" ? r.post_kind : "post",
      gestationalWeekSnapshot:
        typeof r.gestational_week_snapshot === "number" ? r.gestational_week_snapshot : null,
      createdAt: r.created_at as string,
    }));

    return Response.json({
      profile: {
        id: profile.id as string,
        displayName: profile.display_name as string,
        avatarUrl: (profile.avatar_url as string | null) ?? null,
        role: profile.role as string,
        memberSince: profile.created_at as string,
      },
      posts,
    });
  } catch (e) {
    return serverErrorJson("community_member GET", e);
  }
}
