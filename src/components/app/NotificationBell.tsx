"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { formatDistanceToNow } from "date-fns";
import { Bell, ChevronRight, Loader2 } from "lucide-react";

import { CommunityAvatar } from "@/components/community/community-avatar";
import type { NotificationDTO } from "@/lib/notifications/types";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NOTIFICATIONS_UPDATED_EVENT, dispatchNotificationsUpdated } from "@/lib/notifications/events";
import { useNotificationsRealtime } from "@/hooks/use-notifications-realtime";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const BELL_FETCH_LIMIT = 50;

export function NotificationBell() {
  const router = useRouter();
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?limit=${BELL_FETCH_LIMIT}`, { credentials: "include" });
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

  useEffect(() => {
    void load();
  }, [load]);

  useNotificationsRealtime(user?.id, dispatchNotificationsUpdated);

  useEffect(() => {
    const onFocus = () => void load();
    const onUpdated = () => void load();
    window.addEventListener("focus", onFocus);
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdated);
    const id = window.setInterval(() => void load(), 5 * 60_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdated);
      window.clearInterval(id);
    };
  }, [load]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      void (async () => {
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
          await load();
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
          <Bell className="h-5 w-5 transition-transform duration-150 ease-out group-active:scale-110 motion-reduce:group-active:scale-100" />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="flex h-[100dvh] w-full max-w-full flex-col gap-0 border-l-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="shrink-0 space-y-0 border-b border-border/60 px-4 pb-3 pt-4 text-left">
          <div className="flex items-center justify-between gap-2 pr-10">
            <SheetTitle className="font-display text-lg">Notifications</SheetTitle>
            {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />}
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {notifications.length === 0 && !loading ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full touch-manipulation items-start gap-3 px-4 py-3 text-left transition-[transform,background-color] duration-150 active:scale-[0.99] motion-reduce:active:scale-100",
                      !n.readAt ? "bg-primary-soft/40" : "bg-background hover:bg-muted/50",
                    )}
                    onClick={() => onOpenItem(n)}
                  >
                    <CommunityAvatar
                      url={null}
                      name={n.actorDisplayName ?? n.title}
                      className="mt-0.5 h-11 w-11 shrink-0"
                      fallbackClassName="bg-muted text-xs font-semibold text-muted-foreground"
                    />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-sm font-semibold leading-snug text-foreground">{n.title}</p>
                      {n.actorDisplayName ? (
                        <p className="text-xs text-muted-foreground">From {n.actorDisplayName}</p>
                      ) : null}
                      {n.body ? (
                        <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">{n.body}</p>
                      ) : null}
                      <p className="text-[11px] text-muted-foreground/90">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="shrink-0 border-t border-border/60 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button variant="outline" className="w-full rounded-xl" asChild>
            <Link
              href="/notifications"
              onClick={() => {
                setOpen(false);
              }}
            >
              View all notifications
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
