import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { getSubscriptionView } from "@/lib/subscription/repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in to view your subscription.");

    const supabase = await createSupabaseServerClient();
    const subscription = await getSubscriptionView(supabase, session.id);
    return Response.json({ subscription });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    if (/user_subscriptions|relation.*does not exist|schema cache/i.test(raw)) {
      return failJson(503, "Subscription is not set up yet. Please try again later.", {
        code: "subscription_unavailable",
      });
    }
    return serverErrorJson("subscription GET", e);
  }
}
