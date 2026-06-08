"use client";

import { useEffect, useRef } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CommunityPostRealtimeChange =
  | { kind: "comment_insert"; commentId: string }
  | { kind: "refresh" };

type Options = {
  /** Debounce refetch for like churn (ms). Comments/post updates fire immediately. */
  likesDebounceMs?: number;
};

/**
 * Live updates for a single community post: comments, likes, and post row updates
 * (e.g. moderation). Caller should refetch via API; RLS limits events to visible data.
 */
export function useCommunityPostRealtime(
  postId: string | null | undefined,
  onChange: (change: CommunityPostRealtimeChange) => void,
  options?: Options,
) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const likesDebounceMs = options?.likesDebounceMs ?? 400;
  const likesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const id = postId?.trim() ?? "";
    if (!id || !UUID_RE.test(id)) return;

    const supabase = createSupabaseBrowserClient();

    const flushRefresh = () => {
      if (likesTimerRef.current) {
        clearTimeout(likesTimerRef.current);
        likesTimerRef.current = null;
      }
      onChangeRef.current({ kind: "refresh" });
    };

    const scheduleRefresh = () => {
      if (likesTimerRef.current) clearTimeout(likesTimerRef.current);
      likesTimerRef.current = setTimeout(() => {
        likesTimerRef.current = null;
        onChangeRef.current({ kind: "refresh" });
      }, likesDebounceMs);
    };

    const channel = supabase
      .channel(`community_post:${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "community_comments",
          filter: `post_id=eq.${id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as { id?: string } | null;
            const commentId = typeof row?.id === "string" ? row.id : "";
            if (commentId) {
              onChangeRef.current({ kind: "comment_insert", commentId });
              return;
            }
          }
          flushRefresh();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "community_post_likes",
          filter: `post_id=eq.${id}`,
        },
        () => {
          scheduleRefresh();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "community_posts",
          filter: `id=eq.${id}`,
        },
        () => {
          flushRefresh();
        },
      )
      .subscribe();

    return () => {
      if (likesTimerRef.current) {
        clearTimeout(likesTimerRef.current);
        likesTimerRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [postId, likesDebounceMs]);
}
