"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken, isSupported, onMessage, type Messaging } from "firebase/messaging";

import type { FirebasePublicConfig } from "@/lib/push/firebase-config";

export type PushConfigResponse = {
  /** Server can send FCM messages (service account present). */
  configured: boolean;
  /** Browser can register (public Firebase + VAPID keys). */
  clientReady: boolean;
  firebase: FirebasePublicConfig | null;
  vapidKey: string | null;
};

let messagingApp: FirebaseApp | null = null;
let messagingInstance: Messaging | null = null;
let cachedConfig: PushConfigResponse | null = null;
let swRegistration: ServiceWorkerRegistration | null = null;

const EMPTY_PUSH_CONFIG: PushConfigResponse = {
  configured: false,
  clientReady: false,
  firebase: null,
  vapidKey: null,
};

export function clearPushConfigCache(): void {
  cachedConfig = null;
}

export async function isPushSupported(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!window.isSecureContext) return false;
  try {
    return await isSupported();
  } catch {
    return false;
  }
}

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isIosPwaInstalled(): boolean {
  if (!isIosDevice()) return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Safari tab on iPhone — web push not available until Add to Home Screen. */
export function isIosWebPushLimited(): boolean {
  return isIosDevice() && !isIosPwaInstalled();
}

function detectPushPlatform(): "web" | "ios" {
  return isIosPwaInstalled() ? "ios" : "web";
}

export async function fetchPushConfig(): Promise<PushConfigResponse> {
  if (cachedConfig) return cachedConfig;
  const res = await fetch("/api/push/config");
  if (!res.ok) {
    cachedConfig = EMPTY_PUSH_CONFIG;
    return cachedConfig;
  }
  const data = (await res.json()) as PushConfigResponse;
  cachedConfig = {
    configured: Boolean(data.configured),
    clientReady: Boolean(data.clientReady),
    firebase: data.firebase ?? null,
    vapidKey: data.vapidKey ?? null,
  };
  return cachedConfig;
}

async function getMessagingClient(): Promise<Messaging | null> {
  if (!(await isPushSupported())) return null;

  const config = await fetchPushConfig();
  if (!config.clientReady || !config.firebase) return null;

  if (!messagingApp) {
    messagingApp = getApps()[0] ?? initializeApp(config.firebase);
  }

  if (!messagingInstance) {
    messagingInstance = getMessaging(messagingApp);
  }

  return messagingInstance;
}

async function registerFcmServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  if (swRegistration) return swRegistration;
  try {
    swRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/",
    });
    await navigator.serviceWorker.ready;
    return swRegistration;
  } catch (e) {
    console.warn("[fcm] service worker registration failed", e);
    return null;
  }
}

export async function getStoredFcmToken(): Promise<string | null> {
  const res = await fetch("/api/push/token", { credentials: "include" });
  if (!res.ok) return null;
  const data = (await res.json()) as { token: string | null };
  return data.token ?? null;
}

export type SubscribePushResult =
  | { ok: true; token: string }
  | { ok: false; reason: "unsupported" | "denied" | "not_configured" | "sw_failed" | "no_token" | "save_failed" };

export async function subscribeToPush(): Promise<SubscribePushResult> {
  if (!(await isPushSupported())) {
    return { ok: false, reason: "unsupported" };
  }

  if (isIosWebPushLimited()) {
    return { ok: false, reason: "unsupported" };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, reason: "denied" };
  }

  const config = await fetchPushConfig();
  if (!config.clientReady || !config.firebase || !config.vapidKey) {
    return { ok: false, reason: "not_configured" };
  }

  const messaging = await getMessagingClient();
  const registration = await registerFcmServiceWorker();
  if (!messaging || !registration) {
    return { ok: false, reason: "sw_failed" };
  }

  let token: string | null = null;
  try {
    token = await getToken(messaging, {
      vapidKey: config.vapidKey,
      serviceWorkerRegistration: registration,
    });
  } catch (e) {
    console.error("[fcm] getToken", e);
    return { ok: false, reason: "no_token" };
  }

  if (!token) {
    return { ok: false, reason: "no_token" };
  }

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, platform: detectPushPlatform() }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[fcm] subscribe save", text);
    try {
      const body = JSON.parse(text) as { message?: string; hint?: string };
      if (body.message && process.env.NODE_ENV === "development") {
        console.error("[fcm] subscribe hint:", body.message);
      }
    } catch {
      /* ignore */
    }
    return { ok: false, reason: "save_failed" };
  }

  return { ok: true, token };
}

export async function unsubscribeFromPush(): Promise<void> {
  const token = await getStoredFcmToken();
  if (token) {
    await fetch("/api/push/unsubscribe", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  }

  try {
    const messaging = await getMessagingClient();
    if (messaging) {
      const { deleteToken } = await import("firebase/messaging");
      await deleteToken(messaging);
    }
  } catch {
    /* ignore */
  }
}

export function listenForForegroundMessages(
  onPayload: (payload: { title?: string; body?: string; url?: string }) => void,
): () => void {
  let cancelled = false;
  let unsubscribe: (() => void) | undefined;

  void (async () => {
    const messaging = await getMessagingClient();
    if (!messaging || cancelled) return;
    unsubscribe = onMessage(messaging, (payload) => {
      const title = payload.notification?.title ?? payload.data?.title;
      const body = payload.notification?.body ?? payload.data?.body;
      const url = payload.data?.url;
      onPayload({
        title: title ?? undefined,
        body: body ?? undefined,
        url: url ?? undefined,
      });
    });
  })();

  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}
