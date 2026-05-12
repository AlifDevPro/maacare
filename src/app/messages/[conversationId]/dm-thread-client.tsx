"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { formatDistanceToNow } from "date-fns";
import { Send } from "lucide-react";
import { DmThreadSkeleton } from "./dm-thread-skeleton";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CommunityAvatar } from "@/components/community/community-avatar";
import { dispatchDmUnreadUpdated } from "@/lib/dm/events";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type Msg = { id: string; sender_id: string; body: string; created_at: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function DmThreadClient() {
  const params = useParams();
  const router = useRouter();
  const { user } = useSession();
  const rawId = typeof params.conversationId === "string" ? params.conversationId : "";
  const valid = UUID_RE.test(rawId);

  const [meta, setMeta] = useState<{
    peerDisplayName: string;
    peerAvatarUrl: string | null;
    peerUserId: string;
  } | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadAll = useCallback(async () => {
    if (!valid) return;
    setLoading(true);
    try {
      const [mRes, msgRes] = await Promise.all([
        fetch(`/api/dm/conversations/${rawId}`, { credentials: "include" }),
        fetch(`/api/dm/conversations/${rawId}/messages`, { credentials: "include" }),
      ]);
      if (mRes.status === 404 || msgRes.status === 404) {
        setMeta(null);
        setMessages([]);
        return;
      }
      if (!mRes.ok || !msgRes.ok) {
        const j = (await mRes.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? "Could not load thread");
      }
      const mJson = (await mRes.json()) as {
        peerDisplayName: string;
        peerAvatarUrl: string | null;
        peerUserId: string;
      };
      const msgJson = (await msgRes.json()) as { messages: Msg[] };
      setMeta(mJson);
      setMessages(msgJson.messages ?? []);

      const readRes = await fetch(`/api/dm/conversations/${rawId}/read`, {
        method: "POST",
        credentials: "include",
      });
      if (readRes.ok) dispatchDmUnreadUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load thread");
      setMeta(null);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [rawId, valid]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!valid || !rawId) return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`dm_thread_${rawId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dm_messages",
          filter: `conversation_id=eq.${rawId}`,
        },
        (payload) => {
          const row = payload.new as Msg | null;
          if (!row?.id) return;
          setMessages((prev) => {
            if (prev.some((p) => p.id === row.id)) return prev;
            return [...prev, row];
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [rawId, valid]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const text = draft.trim();
    if (!text || !valid || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/dm/conversations/${rawId}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        posted?: Msg;
        message?: string;
      };
      if (!res.ok) throw new Error(j.message ?? "Send failed");
      const added = j.posted;
      if (added?.id) {
        setMessages((prev) => (prev.some((p) => p.id === added.id) ? prev : [...prev, added]));
      }
      setDraft("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  const title = meta?.peerDisplayName ?? "Chat";

  const ordered = useMemo(() => [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()), [messages]);

  if (!valid) {
    return (
      <AppShell>
        <AppHeader title="Messages" showBack backHref="/messages" showNotifications />
        <p className="px-4 pt-8 text-sm text-muted-foreground">Invalid conversation.</p>
      </AppShell>
    );
  }

  if (!loading && !meta) {
    return (
      <AppShell>
        <AppHeader title="Messages" showBack backHref="/messages" showNotifications />
        <p className="px-4 pt-8 text-sm text-muted-foreground">
          This chat is unavailable.{" "}
          <button type="button" className="font-medium text-primary underline" onClick={() => router.push("/messages")}>
            Back to inbox
          </button>
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <AppHeader
        title={title}
        showBack
        backHref="/messages"
        showNotifications
        right={
          meta ? (
            <CommunityAvatar
              url={meta.peerAvatarUrl}
              name={meta.peerDisplayName}
              className="h-8 w-8"
              fallbackClassName="bg-primary-soft text-xs font-semibold"
            />
          ) : null
        }
      />

      {!loading && meta ? (
        <>
          <div className="max-h-[calc(100dvh-14rem)] overflow-y-auto px-4 pb-32 pt-3">
            <div className="space-y-2">
              {ordered.map((m) => {
                const mine = user?.id === m.sender_id;
                return (
                  <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                        mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={cn("mt-1 text-[10px] opacity-80", mine ? "text-primary-foreground" : "text-muted-foreground")}>
                        {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="fixed inset-x-0 bottom-24 z-30 border-t border-border/80 bg-background/95 pt-2 pb-2 backdrop-blur-md supports-[backdrop-filter]:bg-background/85">
            <div className="mx-auto flex max-w-md min-w-0 gap-2 px-4">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a message…"
                rows={2}
                className="min-h-[44px] flex-1 resize-none rounded-xl"
                maxLength={8000}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <Button
                type="button"
                size="icon"
                className="h-11 w-11 shrink-0 rounded-xl"
                onClick={() => void send()}
                disabled={sending || !draft.trim()}
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      ) : loading ? (
        <DmThreadSkeleton />
      ) : null}
    </AppShell>
  );
}
