import { NextRequest } from "next/server";

import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { loadNotificationsPayload } from "@/lib/app/user-lists-data";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type { NotificationDTO } from "@/lib/notifications/types";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in to view notifications.");

    const supabase = await createSupabaseServerClient();
    const uid = session.id;

    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "40") || 40, 80);

    try {
      const payload = await loadNotificationsPayload(supabase, uid, limit);
      return Response.json(payload);
    } catch (error: unknown) {
      console.error("notifications list", error);
      const msg = error instanceof Error ? error.message : "Could not load notifications.";
      const hint = process.env.NODE_ENV === "development" ? msg : "Could not load notifications.";
      return failJson(500, hint);
    }
  } catch (e) {
    return serverErrorJson("notifications GET", e);
  }
}
