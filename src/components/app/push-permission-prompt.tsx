"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  fetchPushConfig,
  getStoredFcmToken,
  isIosPwaInstalled,
  isIosWebPushLimited,
  isPushSupported,
  subscribeToPush,
  type SubscribePushResult,
} from "@/lib/push/client";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "maacare_push_prompt_dismissed";

function subscribeErrorMessage(result: Extract<SubscribePushResult, { ok: false }>): string {
  switch (result.reason) {
    case "denied":
      return "Notifications are blocked. Allow them in your browser site settings.";
    case "not_configured":
      return "Push is not set up on this server yet (Firebase keys missing).";
    case "sw_failed":
      return "Could not register the notification service. Try a hard refresh.";
    case "no_token":
      return "Could not connect to Firebase. Check your VAPID key in Firebase Console.";
    case "save_failed":
      return "Could not save this device. Sign in again or try later.";
    case "unsupported":
    default:
      if (isIosWebPushLimited()) {
        return "On iPhone/iPad: tap Share → Add to Home Screen, open MaaCare from the icon, then enable notifications.";
      }
      return "Notifications are not supported in this browser. Use Chrome, Edge, or Safari.";
  }
}

/** In-app banner that triggers the browser notification permission prompt on tap. */
export function PushPermissionPrompt() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  const evaluate = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    if (isIosWebPushLimited()) {
      setIosHint(true);
      setVisible(true);
      return;
    }
    if (!(await isPushSupported())) {
      return;
    }
    setIosHint(isIosPwaInstalled());

    const config = await fetchPushConfig();
    if (!config.clientReady) return;

    if (Notification.permission === "denied") return;

    const stored = await getStoredFcmToken();
    if (stored) return;

    if (Notification.permission === "granted") {
      const result = await subscribeToPush();
      if (result.ok) return;
      setVisible(true);
      return;
    }

    if (Notification.permission === "default") {
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void evaluate(), 1200);
    return () => window.clearTimeout(t);
  }, [evaluate]);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const result = await subscribeToPush();
      if (result.ok) {
        toast.success("Notifications enabled");
        setVisible(false);
        localStorage.removeItem(DISMISS_KEY);
        await fetch("/api/profile", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notifyPushEnabled: true }),
        });
        return;
      }
      toast.error(subscribeErrorMessage(result));
      if (result.reason === "denied") dismiss();
    } finally {
      setBusy(false);
    }
  }, [dismiss]);

  const needsHomeScreen = isIosWebPushLimited();

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Enable notifications"
      className={cn(
        "pointer-events-auto fixed inset-x-0 z-50 mx-auto max-w-lg animate-in fade-in slide-in-from-bottom-4 px-4 duration-300",
        "bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]",
      )}
    >
      <div className="flex items-start gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-lg">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Bell className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Turn on notifications?</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {iosHint === true && isIosWebPushLimited()
              ? "On iPhone: Safari → Share → Add to Home Screen, open MaaCare from the home icon, then tap Enable."
              : iosHint
                ? "Installed app — enable alerts for messages and community activity when your screen is off."
                : "Get alerts for new messages, replies, and likes — even when this tab is in the background."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {needsHomeScreen ? (
              <Button size="sm" onClick={dismiss}>
                Got it
              </Button>
            ) : (
              <Button size="sm" disabled={busy} onClick={() => void enable()}>
                {busy ? "Enabling…" : "Enable"}
              </Button>
            )}
            {!needsHomeScreen ? (
              <Button size="sm" variant="ghost" disabled={busy} onClick={dismiss}>
                Not now
              </Button>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted"
          aria-label="Dismiss"
          onClick={dismiss}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
