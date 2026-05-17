import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("fcm_token")
      .eq("user_id", session.id)
      .not("fcm_token", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[push/token]", error);
      return failJson(500, "Could not load token.");
    }

    return Response.json({ token: data?.fcm_token ?? null });
  } catch (e) {
    return serverErrorJson("push/token", e);
  }
}
