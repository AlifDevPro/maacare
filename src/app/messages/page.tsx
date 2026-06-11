"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { formatDistanceToNow } from "date-fns";
import { Crown, Loader2, Lock, MessageCircle, Search } from "lucide-react";
import { MessagesInboxSkeleton } from "./messages-inbox-skeleton";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { CommunityAvatar } from "@/components/community/community-avatar";
import { MessagesActivePeople } from "@/components/messages/messages-active-people";
import { isSubscriptionPaywallError } from "@/lib/subscription/access";
import { useSubscription } from "@/lib/subscription/use-subscription";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/auth-client";

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

type PeerResult = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  verifiedProfessional?: boolean;
};

function filterRows(rows: Row[], query: string): Row[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => {
    const name = r.peerDisplayName.toLowerCase();
    const preview = (r.lastMessagePreview ?? "").toLowerCase();
    return name.includes(q) || preview.includes(q);
  });
}

export default function MessagesInboxPage() {
  const { t } = useTranslation("messages");
  const { t: tHealth } = useTranslation("health");
  const router = useRouter();
  const { user } = useSession();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [peerResults, setPeerResults] = useState<PeerResult[]>([]);
  const [peerSearching, setPeerSearching] = useState(false);
  const [startingPeerId, setStartingPeerId] = useState<string | null>(null);
  const { subscription, openPaywall } = useSubscription();
  const doctorMessagingUnlocked = subscription.features.doctor_messaging;

  const loadRef = useRef<() => Promise<void>>(async () => {});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dm/conversations", { credentials: "include" });
      const j = (await res.json().catch(() => ({}))) as { conversations?: Row[]; message?: string };
      if (!res.ok) throw new Error(j.message ?? t("toast_load_error"));
      setRows(j.conversations ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("toast_load_error"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadSilent = useCallback(async () => {
    try {
      const res = await fetch("/api/dm/conversations", { credentials: "include" });
      const j = (await res.json().catch(() => ({}))) as { conversations?: Row[]; message?: string };
      if (!res.ok) return;
      setRows(j.conversations ?? []);
    } catch {
      /* keep existing rows */
    }
  }, []);

  loadRef.current = loadSilent;

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user?.id) return;
    const supabase = createSupabaseBrowserClient();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleSilentLoad = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        void loadRef.current();
      }, 500);
    };

    const channel = supabase
      .channel(`dm_inbox:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "dm_messages" },
        (payload) => {
          const row = payload.new as {
            id?: string;
            conversation_id?: string;
            body?: string;
            created_at?: string;
            sender_id?: string;
          } | null;
          const conversationId = row?.conversation_id;
          if (!conversationId || !row?.created_at) {
            scheduleSilentLoad();
            return;
          }
          const preview = typeof row.body === "string" ? row.body.slice(0, 200) : "";
          const fromSelf = row.sender_id === user.id;
          setRows((prev) => {
            const idx = prev.findIndex((r) => r.id === conversationId);
            if (idx < 0) {
              scheduleSilentLoad();
              return prev;
            }
            const item = prev[idx]!;
            const patched: Row = {
              ...item,
              lastMessagePreview: preview || item.lastMessagePreview,
              lastMessageAt: row.created_at ?? item.lastMessageAt,
              updatedAt: row.created_at ?? item.updatedAt,
              hasUnread: fromSelf ? item.hasUnread : true,
            };
            const rest = prev.filter((_, i) => i !== idx);
            return [patched, ...rest];
          });
        },
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const filteredRows = useMemo(() => filterRows(rows, searchQuery), [rows, searchQuery]);
  const trimmedQuery = searchQuery.trim();

  const activePeople = useMemo(() => {
    const seen = new Set<string>();
    const sorted = [...rows].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    const result: {
      peerUserId: string;
      conversationId: string;
      displayName: string;
      avatarUrl: string | null;
      hasUnread: boolean;
    }[] = [];
    for (const r of sorted) {
      if (seen.has(r.peerUserId)) continue;
      seen.add(r.peerUserId);
      result.push({
        peerUserId: r.peerUserId,
        conversationId: r.id,
        displayName: r.peerDisplayName,
        avatarUrl: r.peerAvatarUrl,
        hasUnread: r.hasUnread,
      });
      if (result.length >= 10) break;
    }
    return result;
  }, [rows]);

  useEffect(() => {
    if (trimmedQuery.length < 2) {
      setPeerResults([]);
      setPeerSearching(false);
      return;
    }

    const handle = window.setTimeout(() => {
      void (async () => {
        setPeerSearching(true);
        try {
          const res = await fetch(
            `/api/dm/peers/search?q=${encodeURIComponent(trimmedQuery)}`,
            { credentials: "include" },
          );
          const j = (await res.json().catch(() => ({}))) as {
            peers?: PeerResult[];
            message?: string;
          };
          if (!res.ok) throw new Error(j.message ?? t("toast_load_error"));
          const inboxPeerIds = new Set(rows.map((r) => r.peerUserId));
          setPeerResults((j.peers ?? []).filter((p) => !inboxPeerIds.has(p.id)));
        } catch (e) {
          toast.error(e instanceof Error ? e.message : t("toast_load_error"));
          setPeerResults([]);
        } finally {
          setPeerSearching(false);
        }
      })();
    }, 350);

    return () => window.clearTimeout(handle);
  }, [trimmedQuery, rows, t]);

  async function startChatWithPeer(peerId: string) {
    setStartingPeerId(peerId);
    try {
      const res = await fetch("/api/dm/conversations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peerUserId: peerId }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        conversationId?: string;
        message?: string;
      };
      if (!res.ok) {
        if (res.status === 403 && isSubscriptionPaywallError(j)) {
          openPaywall("doctor_messaging");
          return;
        }
        throw new Error(j.message ?? t("toast_start_chat"));
      }
      if (!j.conversationId) throw new Error(t("toast_start_chat"));
      router.push(`/messages/${j.conversationId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("toast_start_chat"));
    } finally {
      setStartingPeerId(null);
    }
  }

  const showEmptyInbox = !loading && rows.length === 0 && !trimmedQuery;
  const showNoSearchResults =
    !loading && trimmedQuery.length > 0 && filteredRows.length === 0 && peerResults.length === 0 && !peerSearching;

  return (
    <AppShell>
      <AppHeader title={t("inbox_title")} showBack backHref="/app" showNotifications />

      <div className="space-y-3 px-4 pt-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("inbox_search_placeholder")}
            className="h-10 rounded-xl pl-9"
          />
        </div>
      </div>

      {!loading && !trimmedQuery && rows.length > 0 ? (
        <MessagesActivePeople people={activePeople} />
      ) : null}

      <div className="pb-28">
        {loading ? (
          <MessagesInboxSkeleton />
        ) : showEmptyInbox ? (
          <div className="px-4 pt-4">
            <Card className="p-6 text-center text-sm text-muted-foreground">
              <MessageCircle className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p>{t("empty_inbox")}</p>
            </Card>
          </div>
        ) : showNoSearchResults ? (
          <div className="px-4 pt-4">
            <Card className="p-6 text-center text-sm text-muted-foreground">
              <p>{t("inbox_no_search_results")}</p>
            </Card>
          </div>
        ) : (
          <div className="space-y-4 px-4 pt-4">
            {filteredRows.length > 0 ? (
              <ul className="space-y-2">
                {filteredRows.map((r) => (
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
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {r.lastMessagePreview || t("say_hello")}
                          </p>
                          {r.hasUnread ? (
                            <span
                              className="mt-1 inline-block h-2 w-2 rounded-full bg-primary"
                              aria-label={t("unread_aria")}
                            />
                          ) : null}
                        </div>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}

            {trimmedQuery.length >= 2 ? (
              <div>
                <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("inbox_people_section")}
                </p>
                {peerSearching ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : peerResults.length > 0 ? (
                  <ul className="space-y-2">
                    {peerResults.map((p) => {
                      const doctorPeerLocked = p.verifiedProfessional && !doctorMessagingUnlocked;
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            className="w-full text-left"
                            disabled={startingPeerId === p.id}
                            onClick={() => {
                              if (doctorPeerLocked) {
                                openPaywall("doctor_messaging");
                                return;
                              }
                              void startChatWithPeer(p.id);
                            }}
                          >
                            <Card
                              className={`flex gap-3 p-3 transition-colors ${
                                doctorPeerLocked
                                  ? "border-dashed border-amber-500/30 bg-amber-500/5"
                                  : "hover:bg-muted/40"
                              }`}
                            >
                              <CommunityAvatar
                                url={p.avatarUrl}
                                name={p.displayName}
                                className="h-11 w-11 shrink-0"
                                fallbackClassName="bg-primary-soft text-sm font-semibold"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">{p.displayName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {doctorPeerLocked ? tHealth("subscription_dm_locked_hint") : t("thread_active")}
                                </p>
                              </div>
                              {doctorPeerLocked ? (
                                <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                                  <Lock className="h-3 w-3" />
                                  <Crown className="h-3 w-3" />
                                </span>
                              ) : startingPeerId === p.id ? (
                                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                              ) : null}
                            </Card>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : filteredRows.length === 0 ? null : null}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </AppShell>
  );
}
