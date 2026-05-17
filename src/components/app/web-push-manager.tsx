"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { PushPermissionPrompt } from "@/components/app/push-permission-prompt";
import { useSession } from "@/lib/auth-client";
import {
  fetchPushConfig,
  getStoredFcmToken,
  isPushSupported,
  listenForForegroundMessages,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push/client";

/** Syncs FCM token when signed in; shows in-app toast for foreground pushes. */
export function WebPushManager() {
  const { user, loading } = useSession();

  const syncPush = useCallback(async () => {
    if (!user || !(await isPushSupported())) return;
    const config = await fetchPushConfig();
    if (!config.clientReady) return;

    const existing = await getStoredFcmToken();
    if (existing) return;

    if (Notification.permission === "granted") {
      await subscribeToPush();
    }
  }, [user]);

  useEffect(() => {
    if (loading || !user) return;
    void syncPush();
  }, [loading, user, syncPush]);

  useEffect(() => {
    if (!user) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void syncPush();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [user, syncPush]);

  useEffect(() => {
    if (!user) return;
    return listenForForegroundMessages((payload) => {
      if (payload.title) {
        toast(payload.title, { description: payload.body });
      }
    });
  }, [user]);

  if (loading || !user) return null;

  return <PushPermissionPrompt />;
}

export function useWebPushControls() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [clientReady, setClientReady] = useState(false);
  const [serverReady, setServerReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  const refresh = useCallback(async () => {
    const ok = await isPushSupported();
    setSupported(ok);
    if (!ok) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
    const config = await fetchPushConfig();
    setClientReady(config.clientReady);
    setServerReady(config.configured);
    const token = await getStoredFcmToken();
    setSubscribed(Boolean(token));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const result = await subscribeToPush();
      setSubscribed(result.ok);
      setPermission(Notification.permission);
      return result;
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      await unsubscribeFromPush();
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    supported,
    clientReady,
    serverReady,
    /** @deprecated use clientReady */
    configured: clientReady,
    subscribed,
    busy,
    permission,
    enable,
    disable,
    refresh,
  };
}
