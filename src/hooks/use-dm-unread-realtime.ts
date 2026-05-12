"use client";

import { useEffect, useRef } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const DEBOUNCE_MS = 400;

/** Bump unread count when new DMs arrive (RLS limits events to visible rows). */
export function useDmUnreadRealtime(
  userId: string | undefined,
  onRefresh: () => void,
  onForeignMessageInsert?: () => void,
) {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const onForeignInsertRef = useRef(onForeignMessageInsert);
  onForeignInsertRef.current = onForeignMessageInsert;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) return;

    const supabase = createSupabaseBrowserClient();

    const bump = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        onRefreshRef.current();
      }, DEBOUNCE_MS);
    };

    const onMessageInsert = (payload: { new?: Record<string, unknown> | null }) => {
      const row = payload.new;
      const senderId =
        typeof row?.sender_id === "string"
          ? row.sender_id
          : typeof row?.senderId === "string"
            ? row.senderId
            : undefined;
      if (!senderId || senderId === userId) return;
      onForeignInsertRef.current?.();
      bump();
    };

    const channel = supabase
      .channel(`dm_unread:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "dm_messages" },
        onMessageInsert,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "dm_participants" },
        bump,
      )
      .subscribe();

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [userId]);
}
