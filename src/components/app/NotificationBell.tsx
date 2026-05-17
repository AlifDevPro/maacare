"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ArrowLeft, Loader2 } from "lucide-react";

import { NotificationRow } from "@/components/notifications/notification-row";
import type { NotificationDTO } from "@/lib/notifications/types";
import { Button } from "@/components/ui/button";
import { AppShellInsetSheetContent } from "@/components/app/app-shell-inset-sheet";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NOTIFICATIONS_UPDATED_EVENT, dispatchNotificationsUpdated } from "@/lib/notifications/events";
import { useNotificationsRealtime } from "@/hooks/use-notifications-realtime";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const BELL_FETCH_LIMIT = 50;

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}

export function NotificationBell() {
  const router = useRouter();
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadFull = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?limit=${BELL_FETCH_LIMIT}`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        notifications: NotificationDTO[];
        unreadCount: number;
      };
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch(`/api/notifications?summary=1`, { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as { unreadCount: number };
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useNotificationsRealtime(user?.id, dispatchNotificationsUpdated);

  useEffect(() => {
    const onFocus = () => void (open ? loadFull() : loadSummary());
    const onUpdated = () => void (open ? loadFull() : loadSummary());
    window.addEventListener("focus", onFocus);
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdated);
    const id = window.setInterval(() => void loadSummary(), 5 * 60_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdated);
      window.clearInterval(id);
    };
  }, [loadFull, loadSummary, open]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      void (async () => {
        await loadFull();
        try {
          const res = await fetch("/api/notifications/mark-read", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ all: true }),
          });
          if (res.ok) {
            const now = new Date().toISOString();
            setUnreadCount(0);
            setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? now })));
          }
        } catch {
          /* ignore */
        } finally {
          dispatchNotificationsUpdated();
          await loadFull();
        }
      })();
    }
  };

  function onOpenItem(n: NotificationDTO) {
    setOpen(false);
    if (n.linkPath) router.push(n.linkPath);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="group relative shrink-0"
          aria-label="Notifications"
          aria-expanded={open}
        >
          <BellIcon className="h-5 w-5 transition-transform duration-150 ease-out group-active:scale-110 motion-reduce:group-active:scale-100" />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <AppShellInsetSheetContent
        showCloseButton={false}
        className="flex h-full w-full max-w-full flex-col gap-0 p-0"
      >
        <SheetHeader className="shrink-0 space-y-0 border-b border-border/60 px-3 pb-3 pt-3 text-left">
          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="group h-9 w-9 shrink-0"
              aria-label="Back"
              onClick={() => setOpen(false)}
            >
              <ArrowLeft className="h-5 w-5 transition-transform duration-150 ease-out group-active:scale-110 motion-reduce:group-active:scale-100" />
            </Button>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
              {loading ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
              ) : null}
              <SheetTitle className="font-display text-xl font-semibold tracking-tight">
                Notifications
              </SheetTitle>
            </div>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {notifications.length === 0 && !loading ? (
            <p className="px-4 py-14 text-center text-base text-muted-foreground">
              You&apos;re all caught up.
            </p>
          ) : (
            <ul className="divide-y divide-border/50">
              {notifications.map((n) => (
                <li key={n.id}>
                  <NotificationRow
                    notification={n}
                    compact
                    onClick={() => onOpenItem(n)}
                    className={cn(!n.readAt && "pl-5")}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="shrink-0 border-t border-border/60 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button variant="outline" className="w-full rounded-xl text-base" asChild>
            <Link href="/notifications" onClick={() => setOpen(false)}>
              See all notifications
            </Link>
          </Button>
        </div>
      </AppShellInsetSheetContent>
    </Sheet>
  );
}
