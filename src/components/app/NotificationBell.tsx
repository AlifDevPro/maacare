"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { formatDistanceToNow } from "date-fns";
import { Bell, Loader2 } from "lucide-react";

import type { NotificationDTO } from "@/lib/notifications/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NOTIFICATIONS_UPDATED_EVENT } from "@/lib/notifications/events";
import { cn } from "@/lib/utils";

async function markRead(ids: string[]) {
  if (ids.length === 0) return;
  await fetch("/api/notifications/mark-read", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=12", { credentials: "include" });
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

  useEffect(() => {
    const onFocus = () => void load();
    const onUpdated = () => void load();
    window.addEventListener("focus", onFocus);
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdated);
    const id = window.setInterval(() => void load(), 60_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdated);
      window.clearInterval(id);
    };
  }, [load]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function onOpenItem(n: NotificationDTO) {
    if (!n.readAt) {
      await markRead([n.id]);
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)),
      );
    }
    setOpen(false);
    if (n.linkPath) router.push(n.linkPath);
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="relative h-9 w-9" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[60] w-[min(100vw-2rem,22rem)] p-0">
        <DropdownMenuLabel className="flex items-center justify-between px-3 py-2 font-display text-sm">
          Notifications
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-[min(70vh,320px)] overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              You&apos;re all caught up.
            </p>
          ) : (
            notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className={cn(
                  "cursor-pointer flex-col items-start gap-0.5 rounded-none px-3 py-2.5 focus:bg-muted",
                  !n.readAt && "bg-primary-soft/35",
                )}
                onSelect={(e) => {
                  e.preventDefault();
                  void onOpenItem(n);
                }}
              >
                <span className="text-xs font-semibold leading-tight">{n.title}</span>
                {n.actorDisplayName && (
                  <span className="text-[11px] text-muted-foreground">From {n.actorDisplayName}</span>
                )}
                {n.body && (
                  <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>
                )}
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                </span>
              </DropdownMenuItem>
            ))
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer justify-center py-2 font-medium">
          <Link href="/notifications" onClick={() => setOpen(false)}>
            View all notifications
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
