import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.rpc("dm_unread_conversation_count");

    if (error) {
      if (/function public\.dm_unread_conversation_count|schema cache|42883/i.test(error.message)) {
        return Response.json({ count: 0, degraded: true });
      }
      console.error("[dm/unread-count GET]", error);
      return failJson(500, "Could not load unread count.");
    }

    const n = typeof data === "number" ? data : Number(data);
    const count = Number.isFinite(n) ? Math.min(99, Math.max(0, Math.floor(n))) : 0;

    return Response.json({ count });
  } catch (e) {
    return serverErrorJson("dm/unread-count GET", e);
  }
}
