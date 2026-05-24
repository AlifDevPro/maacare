"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SW_URL = "/firebase-messaging-sw.js";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Optional PWA install prompt only. No “update available” banner — the app is not
 * offline-first; service worker is registered quietly for push messaging.
 */
export function PwaManager() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissedInstall, setDismissedInstall] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    void navigator.serviceWorker.register(SW_URL, { scope: "/" }).catch(() => {
      /* Push SW optional when Firebase is not configured */
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  const onInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") {
      toast.success("MaaCare added to your home screen");
    }
    setInstallEvent(null);
  };

  const standalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true);

  if (!installEvent || dismissedInstall || standalone) return null;

  return (
    <div
      className={cn(
        "pointer-events-auto fixed inset-x-0 z-[60] mx-auto max-w-lg px-4",
        "bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]",
      )}
    >
      <div className="flex items-start gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-lg">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Download className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Install MaaCare</p>
          <p className="text-xs text-muted-foreground">
            Add to your home screen for a full-screen app experience and reliable notifications.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => void onInstall()}>
              Install
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDismissedInstall(true)}>
              Not now
            </Button>
          </div>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted"
          aria-label="Dismiss"
          onClick={() => setDismissedInstall(true)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
