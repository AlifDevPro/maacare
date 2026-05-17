"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken, isSupported, onMessage, type Messaging } from "firebase/messaging";

import type { FirebasePublicConfig } from "@/lib/push/firebase-config";

type PushConfigResponse = {
  configured: boolean;
  firebase: FirebasePublicConfig | null;
  vapidKey: string | null;
};

let messagingApp: FirebaseApp | null = null;
let messagingInstance: Messaging | null = null;
let cachedConfig: PushConfigResponse | null = null;
let swRegistration: ServiceWorkerRegistration | null = null;

export async function isPushSupported(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    return await isSupported();
  } catch {
    return false;
  }
}

export async function fetchPushConfig(): Promise<PushConfigResponse> {
  if (cachedConfig) return cachedConfig;
  const res = await fetch("/api/push/config");
  if (!res.ok) {
    cachedConfig = { configured: false, firebase: null, vapidKey: null };
    return cachedConfig;
  }
  cachedConfig = (await res.json()) as PushConfigResponse;
  return cachedConfig;
}

async function getMessagingClient(): Promise<Messaging | null> {
  if (!(await isPushSupported())) return null;

  const config = await fetchPushConfig();
  if (!config.configured || !config.firebase) return null;

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

export async function subscribeToPush(): Promise<string | null> {
  if (!(await isPushSupported())) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const config = await fetchPushConfig();
  if (!config.configured || !config.firebase || !config.vapidKey) return null;

  const messaging = await getMessagingClient();
  const registration = await registerFcmServiceWorker();
  if (!messaging || !registration) return null;

  const token = await getToken(messaging, {
    vapidKey: config.vapidKey,
    serviceWorkerRegistration: registration,
  });

  if (!token) return null;

  await fetch("/api/push/subscribe", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, platform: "web" }),
  });

  return token;
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
