"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { NotificationDTO } from "@/lib/notifications/types";
import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NOTIFICATIONS_UPDATED_EVENT } from "@/lib/notifications/events";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";

export default function NotificationsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useSession();
  const [items, setItems] = useState<NotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=80", { credentials: "include" });
      if (res.status === 401) {
        router.replace("/login?next=/notifications");
        return;
      }
      if (!res.ok) throw new Error("Could not load");
      const data = (await res.json()) as {
        notifications: NotificationDTO[];
        unreadCount: number;
      };
      setItems(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      toast.error("Could not load notifications");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login?next=/notifications");
      return;
    }
    if (user) void load();
  }, [authLoading, user, router, load]);

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
    }
    if (n.linkPath) router.push(n.linkPath);
  }

  if (authLoading || !user) {
    return (
      <AppShell>
        <AppHeader title="Notifications" showBack />
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <AppHeader
        title="Notifications"
        showBack
        right={
          unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              disabled={marking}
              onClick={() => void markAllRead()}
            >
              {marking ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCheck className="mr-1 h-3.5 w-3.5" />
              )}
              Mark all read
            </Button>
          ) : null
        }
      />

      <div className="space-y-3 px-4 pt-4 pb-24">
        <p className="text-sm text-muted-foreground">
          Replies on your community posts and updates from MaaCare appear here.
        </p>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 p-10 text-center shadow-soft">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <Bell className="h-6 w-6 text-muted-foreground" />
            </span>
            <p className="text-sm font-medium">Nothing here yet</p>
            <p className="text-xs text-muted-foreground">
              When someone replies to your post, you&apos;ll see it here.
            </p>
            <Button variant="outline" size="sm" className="rounded-xl" asChild>
              <Link href="/community">Go to community</Link>
            </Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {items.map((n) => (
              <button
                key={n.id}
                type="button"
                className={cn(
                  "w-full rounded-2xl border border-border bg-card p-4 text-left shadow-soft transition-colors hover:bg-muted/40",
                  !n.readAt && "border-primary/25 bg-primary-soft/25",
                )}
                onClick={() => void openOne(n)}
              >
                <p className="font-display text-sm font-semibold">{n.title}</p>
                {n.actorDisplayName && (
                  <p className="mt-0.5 text-xs text-muted-foreground">From {n.actorDisplayName}</p>
                )}
                {n.body && <p className="mt-1 line-clamp-3 text-sm text-foreground/85">{n.body}</p>}
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  {n.linkPath ? " · Tap to open" : ""}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
