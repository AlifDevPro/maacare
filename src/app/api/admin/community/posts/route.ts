import { NextRequest } from "next/server";

import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { requireDbAdmin } from "@/lib/auth/require-db-admin";
import { unwrapProfileEmbed } from "@/lib/community/profile-embed";

export async function GET(req: NextRequest) {
  try {
    const gate = await requireDbAdmin();
    if (!gate.ok) return gate.response;

    const status = req.nextUrl.searchParams.get("status") ?? "all";
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "80") || 80, 150);

    let query = gate.supabase
      .from("community_posts")
      .select(
        `
        id,
        title,
        body,
        post_kind,
        moderation_status,
        created_at,
        author_id,
        is_pinned,
        profiles!author_id (
          display_name,
          email,
          role
        )
      `,
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status === "visible" || status === "hidden" || status === "pending") {
      query = query.eq("moderation_status", status);
    }

    const { data: rows, error } = await query;

    if (error) {
      console.error("[admin/community/posts]", error);
      return failJson(500, "Could not load posts.");
    }

    const posts = (rows ?? []).map((row: Record<string, unknown>) => {
      const profile = unwrapProfileEmbed(row.profiles);
      return {
        id: row.id as string,
        title: row.title as string | null,
        body: row.body as string,
        postKind: typeof row.post_kind === "string" ? row.post_kind : "post",
        moderationStatus: row.moderation_status as string,
        createdAt: row.created_at as string,
        authorId: row.author_id as string,
        authorDisplayName: profile?.display_name ?? "—",
        authorEmail: profile?.email ?? null,
        isPinned: row.is_pinned as boolean,
      };
    });

    return Response.json({ posts });
  } catch (e) {
    return serverErrorJson("admin/community/posts GET", e);
  }
}
