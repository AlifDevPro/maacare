import { getFcmMessaging } from "@/lib/push/firebase-admin";
import { isFcmConfigured } from "@/lib/push/firebase-config";
import { tryCreateSupabaseServiceClient } from "@/lib/supabase/service";

import type { PushChannel, WebPushPayload } from "./types";

type ProfilePushPrefs = {
  notify_push_enabled: boolean;
  notify_community_activity: boolean;
  notify_dm_messages: boolean;
};

async function loadPushPrefs(userId: string): Promise<ProfilePushPrefs | null> {
  const svc = tryCreateSupabaseServiceClient();
  if (!svc) return null;

  const { data, error } = await svc
    .from("profiles")
    .select("notify_push_enabled, notify_community_activity, notify_dm_messages")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    notify_push_enabled: data.notify_push_enabled ?? true,
    notify_community_activity: data.notify_community_activity ?? true,
    notify_dm_messages: data.notify_dm_messages ?? true,
  };
}

function channelAllowed(prefs: ProfilePushPrefs, channel: PushChannel): boolean {
  if (!prefs.notify_push_enabled) return false;
  if (channel === "community") return prefs.notify_community_activity;
  if (channel === "dm") return prefs.notify_dm_messages;
  return true;
}

function absoluteUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim()?.replace(/\/$/, "");
  if (!base) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

const STALE_FCM_CODES = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
]);

/** Send FCM notification to all devices registered for a user. */
export async function sendPushToUser(
  userId: string,
  channel: PushChannel,
  payload: WebPushPayload,
): Promise<{ sent: number; failed: number }> {
  if (!isFcmConfigured()) {
    return { sent: 0, failed: 0 };
  }

  const prefs = await loadPushPrefs(userId);
  if (!prefs || !channelAllowed(prefs, channel)) {
    return { sent: 0, failed: 0 };
  }

  const svc = tryCreateSupabaseServiceClient();
  if (!svc) return { sent: 0, failed: 0 };

  const { data: devices, error } = await svc
    .from("push_subscriptions")
    .select("id, fcm_token, platform")
    .eq("user_id", userId)
    .not("fcm_token", "is", null);

  if (error || !devices?.length) {
    return { sent: 0, failed: 0 };
  }

  const tokens = devices
    .map((d) => d.fcm_token)
    .filter((t): t is string => typeof t === "string" && t.length > 0);

  if (tokens.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const url = absoluteUrl(payload.url);
  const messaging = getFcmMessaging();

  let sent = 0;
  let failed = 0;
  const staleIds: string[] = [];

  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: {
      title: payload.title,
      body: payload.body ?? undefined,
    },
    data: {
      channel,
      url: url ?? "",
      tag: payload.tag ?? "",
      title: payload.title,
      body: payload.body ?? "",
    },
    webpush: url
      ? {
          fcmOptions: { link: url },
          notification: {
            icon: "/window.svg",
            tag: payload.tag ?? undefined,
          },
        }
      : undefined,
    android: {
      priority: "high",
      notification: {
        channelId: channel === "dm" ? "messages" : "updates",
        tag: payload.tag ?? undefined,
        clickAction: url ?? undefined,
      },
    },
    apns: {
      payload: {
        aps: {
          sound: "default",
          badge: 1,
          threadId: payload.tag ?? undefined,
        },
      },
    },
  });

  response.responses.forEach((res, index) => {
    if (res.success) {
      sent += 1;
      return;
    }
    failed += 1;
    const code = res.error?.code;
    if (code && STALE_FCM_CODES.has(code)) {
      const device = devices[index];
      if (device) staleIds.push(device.id);
    }
  });

  if (staleIds.length > 0) {
    await svc.from("push_subscriptions").delete().in("id", staleIds);
  }

  return { sent, failed };
}

/** @deprecated alias */
export const sendWebPushToUser = sendPushToUser;

/** Drain pending rows from push_queue (cron / inline dispatch). */
export async function processPushQueue(limit = 50): Promise<{ processed: number; sent: number }> {
  const svc = tryCreateSupabaseServiceClient();
  if (!svc || !isFcmConfigured()) {
    return { processed: 0, sent: 0 };
  }

  const { data: rows, error } = await svc
    .from("push_queue")
    .select("id, user_id, channel, title, body, link_path, tag")
    .is("processed_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error || !rows?.length) {
    return { processed: 0, sent: 0 };
  }

  let totalSent = 0;

  for (const row of rows) {
    const channel = row.channel as PushChannel;
    const result = await sendPushToUser(row.user_id, channel, {
      title: row.title,
      body: row.body,
      url: row.link_path,
      tag: row.tag,
    });
    totalSent += result.sent;

    await svc
      .from("push_queue")
      .update({ processed_at: new Date().toISOString() })
      .eq("id", row.id);
  }

  return { processed: rows.length, sent: totalSent };
}
