"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { CheckCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { NotificationDTO } from "@/lib/notifications/types";
import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { NotificationRow } from "@/components/notifications/notification-row";
import { Button } from "@/components/ui/button";
import type { NotificationsPayload } from "@/lib/app/user-lists-data";
import { NOTIFICATIONS_UPDATED_EVENT } from "@/lib/notifications/events";

export function NotificationsPageClient({ initial }: { initial: NotificationsPayload }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState<NotificationDTO[]>(initial.notifications);
  const [unreadCount, setUnreadCount] = useState(initial.unreadCount);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    setItems(initial.notifications);
    setUnreadCount(initial.unreadCount);
  }, [initial]);

  async function markAllRead() {
    setMarking(true);
    try {
      const res = await fetch("/api/notifications/mark-read", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) throw new Error();
      setUnreadCount(0);
      setItems((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
      );
      window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
      toast.success("Marked all as read");
      startTransition(() => router.refresh());
    } catch {
      toast.error("Could not update");
    } finally {
      setMarking(false);
    }
  }

  async function openOne(n: NotificationDTO) {
    if (!n.readAt) {
      await fetch("/api/notifications/mark-read", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [n.id] }),
      });
      setUnreadCount((c) => Math.max(0, c - 1));
      setItems((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)),
      );
      window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
      startTransition(() => router.refresh());
    }
    if (n.linkPath) router.push(n.linkPath);
  }

  return (
    <AppShell>
      <AppHeader
        title="Notifications"
        showBack
        showNotifications
        right={
          unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-sm"
              disabled={marking}
              onClick={() => void markAllRead()}
            >
              {marking ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <CheckCheck className="mr-1.5 h-4 w-4" />
              )}
              Mark all read
            </Button>
          ) : null
        }
      />

      <div className="space-y-3 px-4 pt-2 pb-24">
        {isPending ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <CheckCheck className="h-7 w-7 text-muted-foreground" />
            </span>
            <div className="space-y-1">
              <p className="text-lg font-semibold text-foreground">All caught up</p>
              <p className="text-sm text-muted-foreground">
                Likes and comments on your posts will show up here.
              </p>
            </div>
            <Button variant="outline" className="rounded-xl" asChild>
              <Link href="/community">Browse community</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map((n) => (
              <NotificationRow
                key={n.id}
                notification={n}
                onClick={() => void openOne(n)}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
