"use client";

import { memo, useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useDmUnreadRealtime } from "@/hooks/use-dm-unread-realtime";
import { DM_UNREAD_UPDATED_EVENT } from "@/lib/dm/events";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export const MessageBell = memo(function MessageBell() {
  const { user } = useSession();
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!user?.id) {
      setCount((c) => (c === 0 ? c : 0));
      return;
    }
    try {
      const res = await fetch("/api/dm/unread-count", { credentials: "include" });
      if (!res.ok) return;
      const j = (await res.json()) as { count?: number };
      const next = typeof j.count === "number" ? j.count : 0;
      setCount((c) => (c === next ? c : next));
    } catch {
      setCount((c) => (c === 0 ? c : 0));
    }
  }, [user?.id]);

  const onForeignMessageInsert = useCallback(() => {
    setCount((c) => c + 1);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useDmUnreadRealtime(user?.id, load, onForeignMessageInsert);

  useEffect(() => {
    const onFocus = () => void load();
    const onUpdated = () => void load();
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener(DM_UNREAD_UPDATED_EVENT, onUpdated);
    document.addEventListener("visibilitychange", onVisible);
    const id = window.setInterval(() => void load(), 5 * 60_000);
    const pollVisible = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 25_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(DM_UNREAD_UPDATED_EVENT, onUpdated);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(id);
      window.clearInterval(pollVisible);
    };
  }, [load]);

  if (!user?.id) return null;

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className="group relative shrink-0"
      aria-label={count > 0 ? `Messages, ${count} unread` : "Messages"}
      asChild
    >
      <Link href="/messages" className="relative inline-flex items-center justify-center">
        <span className="relative inline-flex">
          <MessageSquare className="h-5 w-5 transition-transform duration-150 ease-out group-active:scale-110 motion-reduce:group-active:scale-100" />
          {count > 0 ? (
            <>
              <span
                className="absolute bottom-0 left-0 h-2 w-2 rounded-full bg-destructive shadow-sm ring-2 ring-background"
                aria-hidden
              />
              <span
                className={cn(
                  "absolute -right-1 -top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full px-0.5 text-[9px] font-bold leading-none text-destructive-foreground",
                  "bg-destructive ring-2 ring-background",
                )}
                aria-hidden
              >
                {count > 9 ? "9+" : count}
              </span>
            </>
          ) : null}
        </span>
      </Link>
    </Button>
  );
});
