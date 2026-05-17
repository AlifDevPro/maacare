import { tryCreateSupabaseServiceClient } from "@/lib/supabase/service";

export type SaveFcmSubscriptionInput = {
  userId: string;
  token: string;
  platform: "web" | "android" | "ios";
  userAgent: string | null;
};

export type SaveFcmSubscriptionResult =
  | { ok: true }
  | { ok: false; message: string; code?: string; hint?: string };

/**
 * Persist FCM token (service role). Uses a synthetic `endpoint` for legacy rows
 * where web-push columns were NOT NULL before the FCM migration.
 */
export async function saveFcmSubscription(
  input: SaveFcmSubscriptionInput,
): Promise<SaveFcmSubscriptionResult> {
  const svc = tryCreateSupabaseServiceClient();
  if (!svc) {
    return {
      ok: false,
      message: "Server missing SUPABASE_SERVICE_ROLE_KEY.",
      hint: "Add SUPABASE_SERVICE_ROLE_KEY to .env and restart the dev server.",
    };
  }

  const { userId, token, platform, userAgent } = input;
  const endpoint = `fcm:${token.slice(0, 500)}`;

  await svc.from("push_subscriptions").delete().eq("fcm_token", token);
  await svc.from("push_subscriptions").delete().eq("user_id", userId).eq("platform", platform);

  const { error } = await svc.from("push_subscriptions").insert({
    user_id: userId,
    fcm_token: token,
    platform,
    endpoint,
    p256dh: "fcm",
    auth_secret: "fcm",
    user_agent: userAgent,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    const hint =
      error.code === "42703"
        ? "Run Supabase migrations 20260523120000_web_push.sql and 20260524120000_fcm_push_tokens.sql."
        : error.code === "42P01"
          ? "Table push_subscriptions is missing — apply web_push migration in Supabase."
          : undefined;

    return {
      ok: false,
      message: error.message,
      code: error.code,
      hint,
    };
  }

  return { ok: true };
}

export async function removeFcmSubscription(
  userId: string,
  token: string,
): Promise<SaveFcmSubscriptionResult> {
  const svc = tryCreateSupabaseServiceClient();
  if (!svc) {
    return { ok: false, message: "Server missing SUPABASE_SERVICE_ROLE_KEY." };
  }

  const { error } = await svc
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("fcm_token", token);

  if (error) {
    return { ok: false, message: error.message, code: error.code };
  }

  return { ok: true };
}
