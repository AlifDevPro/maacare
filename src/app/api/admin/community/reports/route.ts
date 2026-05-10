import { NextRequest } from "next/server";

import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { requireDbAdmin } from "@/lib/auth/require-db-admin";
import { unwrapProfileEmbed } from "@/lib/community/profile-embed";

export async function GET(req: NextRequest) {
  try {
    const gate = await requireDbAdmin();
    if (!gate.ok) return gate.response;

    const status = req.nextUrl.searchParams.get("status") ?? "open";
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "120") || 120, 200);

    let query = gate.supabase
      .from("community_post_reports")
      .select(
        `
        id,
        post_id,
        reporter_id,
        reason,
        details,
        status,
        admin_note,
        reviewed_at,
        created_at,
        community_posts!post_id (
          id,
          title,
          body,
          moderation_status
        ),
        profiles!reporter_id (
          display_name,
          email
        )
      `,
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status === "open" || status === "resolved" || status === "rejected") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[admin/community/reports GET]", error);
      return failJson(500, "Could not load reports.");
    }

    const reports = (data ?? []).map((row: Record<string, unknown>) => {
      const reporter = unwrapProfileEmbed(row.profiles);
      const post = row.community_posts as
        | { id: string; title: string | null; body: string; moderation_status: string }
        | null;
      return {
        id: row.id as string,
        postId: row.post_id as string,
        reporterId: row.reporter_id as string,
        reason: row.reason as string,
        details: row.details as string | null,
        status: row.status as string,
        adminNote: row.admin_note as string | null,
        reviewedAt: row.reviewed_at as string | null,
        createdAt: row.created_at as string,
        reporterDisplayName: reporter?.display_name ?? "Member",
        reporterEmail: reporter?.email ?? null,
        post: post
          ? {
              id: post.id,
              title: post.title,
              body: post.body,
              moderationStatus: post.moderation_status,
            }
          : null,
      };
    });

    return Response.json({ reports });
  } catch (e) {
    return serverErrorJson("admin/community/reports GET", e);
  }
}

