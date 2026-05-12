"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { formatDistanceToNow } from "date-fns";
import { MessageCircle } from "lucide-react";
import { MessagesInboxSkeleton } from "./messages-inbox-skeleton";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Card } from "@/components/ui/card";
import { CommunityAvatar } from "@/components/community/community-avatar";

type Row = {
  id: string;
  updatedAt: string;
  peerUserId: string;
  peerDisplayName: string;
  peerAvatarUrl: string | null;
  lastMessagePreview: string;
  lastMessageAt: string | null;
  hasUnread: boolean;
};

export default function MessagesInboxPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dm/conversations", { credentials: "include" });
      const j = (await res.json().catch(() => ({}))) as { conversations?: Row[]; message?: string };
      if (!res.ok) throw new Error(j.message ?? "Could not load messages");
      setRows(j.conversations ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load messages");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell>
      <AppHeader title="Messages" showBack backHref="/app" showNotifications />

      <div className="pb-28">
        {loading ? (
          <MessagesInboxSkeleton />
        ) : rows.length === 0 ? (
          <div className="px-4 pt-4">
          <Card className="p-6 text-center text-sm text-muted-foreground">
            <MessageCircle className="mx-auto mb-2 h-8 w-8 opacity-50" />
            No conversations yet. Open a member profile in Community and tap{" "}
            <span className="font-medium text-foreground">Message</span>.
          </Card>
          </div>
        ) : (
          <ul className="space-y-2 px-4 pt-4">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/messages/${r.id}`} className="block">
                  <Card className="flex gap-3 p-3 transition-colors hover:bg-muted/40">
                    <CommunityAvatar
                      url={r.peerAvatarUrl}
                      name={r.peerDisplayName}
                      className="h-11 w-11 shrink-0"
                      fallbackClassName="bg-primary-soft text-sm font-semibold"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold">{r.peerDisplayName}</p>
                        {r.lastMessageAt ? (
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(r.lastMessageAt), { addSuffix: true })}
                          </span>
                        ) : null}
                      </div>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{r.lastMessagePreview || "Say hello"}</p>
                      {r.hasUnread ? (
                        <span className="mt-1 inline-block h-2 w-2 rounded-full bg-primary" aria-label="Unread" />
                      ) : null}
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
