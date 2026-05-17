"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const VERSION_KEY = "maacare_app_version";
const SW_URL = "/firebase-messaging-sw.js";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** PWA install prompt + soft app updates (no forced full-page reload until you tap Update). */
export function PwaManager() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const [dismissedInstall, setDismissedInstall] = useState(false);

  const applyUpdate = useCallback(() => {
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => {
        void fetch("/api/app/version", { cache: "no-store" })
          .then((r) => r.json())
          .then((data: { version?: string }) => {
            if (data.version) localStorage.setItem(VERSION_KEY, data.version);
          })
          .finally(() => window.location.reload());
      },
      { once: true },
    );
    void navigator.serviceWorker.getRegistration().then((registration) => {
      registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
    });
    setUpdateReady(false);
    toast.success("Updating MaaCare…");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    void navigator.serviceWorker.register(SW_URL, { scope: "/" }).then((registration) => {
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            setUpdateReady(true);
          }
        });
      });

      if (registration.waiting && navigator.serviceWorker.controller) {
        setUpdateReady(true);
      }
    });

    const checkVersion = async () => {
      try {
        const res = await fetch("/api/app/version", { cache: "no-store" });
        if (!res.ok) return;
        const { version } = (await res.json()) as { version: string };
        const stored = localStorage.getItem(VERSION_KEY);
        if (stored && stored !== version) {
          setUpdateReady(true);
        }
        if (!stored) {
          localStorage.setItem(VERSION_KEY, version);
        }
      } catch {
        /* ignore */
      }
    };

    void checkVersion();
    const interval = window.setInterval(() => void checkVersion(), 10 * 60_000);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.clearInterval(interval);
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

  if (standalone && !updateReady) return null;

  if (updateReady) {
    return (
      <div
        className={cn(
          "pointer-events-auto fixed inset-x-0 z-[60] mx-auto max-w-lg px-4",
          "bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]",
        )}
      >
        <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-lg">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <RefreshCw className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Update ready</p>
            <p className="text-xs text-muted-foreground">
              A new version of MaaCare is available. Update now to get the latest fixes.
            </p>
          </div>
          <Button size="sm" onClick={applyUpdate}>
            Update
          </Button>
        </div>
      </div>
    );
  }

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
