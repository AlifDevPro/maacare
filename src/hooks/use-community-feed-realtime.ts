"use client";

import { useEffect, useRef } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const DEBOUNCE_MS = 450;

/**
 * When enabled, debounce-bump on visible community_posts INSERT/UPDATE (RLS applies).
 * Use for a "refresh feed" banner rather than reloading on every event.
 */
export function useCommunityFeedRealtime(enabled: boolean, onActivity: () => void) {
  const onActivityRef = useRef(onActivity);
  onActivityRef.current = onActivity;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const supabase = createSupabaseBrowserClient();

    const bump = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        onActivityRef.current();
      }, DEBOUNCE_MS);
    };

    const channel = supabase
      .channel("community_feed_posts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_posts" },
        bump,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "community_posts" },
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
  }, [enabled]);
}
