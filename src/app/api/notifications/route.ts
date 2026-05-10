import { NextRequest } from "next/server";

import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import type { NotificationDTO } from "@/lib/notifications/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type { NotificationDTO };

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in to view notifications.");

    const supabase = await createSupabaseServerClient();
    const uid = session.id;

    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "40") || 40, 80);

    const [{ data: rows, error }, { count: unreadCount, error: countErr }] = await Promise.all([
      supabase
        .from("notifications")
        .select("id, kind, title, body, link_path, read_at, created_at, actor_id")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", uid)
        .is("read_at", null),
    ]);

    if (error) {
      console.error("notifications list", error);
      const hint =
        process.env.NODE_ENV === "development" ? error.message : "Could not load notifications.";
      return failJson(500, hint);
    }

    if (countErr) {
      console.warn("notifications unread count", countErr.message);
    }

    const list = rows ?? [];
    const actorIds = [...new Set(list.map((r) => r.actor_id).filter(Boolean))] as string[];

    const actorNames: Record<string, string> = {};
    if (actorIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", actorIds);

      for (const p of profs ?? []) {
        actorNames[p.id as string] = p.display_name as string;
      }
    }

    const notifications: NotificationDTO[] = list.map((r) => ({
      id: r.id as string,
      kind: r.kind as string,
      title: r.title as string,
      body: (r.body as string | null) ?? null,
      linkPath: (r.link_path as string | null) ?? null,
      readAt: (r.read_at as string | null) ?? null,
      createdAt: r.created_at as string,
      actorId: (r.actor_id as string | null) ?? null,
      actorDisplayName: r.actor_id ? actorNames[r.actor_id as string] ?? null : null,
    }));

    return Response.json({
      notifications,
      unreadCount: unreadCount ?? 0,
    });
  } catch (e) {
    return serverErrorJson("notifications GET", e);
  }
}
