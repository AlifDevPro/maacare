"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Heart } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";

import { COMMUNITY_ACTION, COMMUNITY_ACTION_ICON } from "@/lib/community/action-row-styles";
import { syncPostLikeToServer } from "@/lib/community/sync-post-like";
import { cn } from "@/lib/utils";

const SYNC_DEBOUNCE_MS = 180;
const BURST_PARTICLES = 8;

type CommunityLikeButtonProps = {
  postId: string;
  likedByMe: boolean;
  likeCount: number;
  onUpdate: (postId: string, patch: { likedByMe: boolean; likeCount: number }) => void;
  onPendingChange?: (postId: string, pending: boolean) => void;
  className?: string;
  countClassName?: string;
};

export function CommunityLikeButton({
  postId,
  likedByMe,
  likeCount,
  onUpdate,
  onPendingChange,
  className,
  countClassName,
}: CommunityLikeButtonProps) {
  const reduceMotion = useReducedMotion();
  const [burstKey, setBurstKey] = useState(0);
  const [displayState, setDisplayState] = useState({ likedByMe, likeCount });
  const desiredRef = useRef({ likedByMe, likeCount });
  const confirmedRef = useRef({ likedByMe, likeCount });
  const syncGenRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failedOnceRef = useRef(false);
  const syncPendingRef = useRef(false);
  const inFlightRef = useRef(false);

  const setPending = useCallback(
    (pending: boolean) => {
      if (syncPendingRef.current === pending) return;
      syncPendingRef.current = pending;
      onPendingChange?.(postId, pending);
    },
    [onPendingChange, postId],
  );

  useEffect(() => {
    if (!syncPendingRef.current) {
      desiredRef.current = { likedByMe, likeCount };
      setDisplayState({ likedByMe, likeCount });
    }
    confirmedRef.current = { likedByMe, likeCount };
  }, [postId, likedByMe, likeCount]);

  const flushSync = useCallback(async () => {
    inFlightRef.current = true;
    const gen = ++syncGenRef.current;
    const target = desiredRef.current;

    const result = await syncPostLikeToServer(postId, target.likedByMe);
    if (gen !== syncGenRef.current) {
      debounceTimerRef.current = setTimeout(() => void flushSync(), 120);
      inFlightRef.current = false;
      return;
    }

    if (!result.ok) {
      if (!failedOnceRef.current) {
        failedOnceRef.current = true;
        toast.error(result.message);
      }
      desiredRef.current = confirmedRef.current;
      setDisplayState(confirmedRef.current);
      onUpdate(postId, confirmedRef.current);
      inFlightRef.current = false;
      setPending(false);
      return;
    }

    failedOnceRef.current = false;
    const reconciled = { likedByMe: result.liked, likeCount: result.likeCount };
    confirmedRef.current = reconciled;
    desiredRef.current = reconciled;
    setDisplayState(reconciled);
    onUpdate(postId, reconciled);
    inFlightRef.current = false;
    if (!debounceTimerRef.current) {
      setPending(false);
    }
  }, [onUpdate, postId, setPending]);

  const scheduleSync = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setPending(true);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      void flushSync();
    }, SYNC_DEBOUNCE_MS);
  }, [flushSync, setPending]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
        void flushSync();
      }
      setPending(false);
    };
  }, [flushSync, setPending]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const cur = desiredRef.current;
    const nextLiked = !cur.likedByMe;
    const next = {
      likedByMe: nextLiked,
      likeCount: Math.max(0, cur.likeCount + (nextLiked ? 1 : -1)),
    };
    desiredRef.current = next;
    setDisplayState(next);
    onUpdate(postId, next);
    if (nextLiked && !reduceMotion) {
      setBurstKey((k) => k + 1);
    }
    setPending(true);
    if (!inFlightRef.current && !debounceTimerRef.current) {
      void flushSync();
      return;
    }
    scheduleSync();
  };

  return (
    <motion.button
      type="button"
      layout={false}
      className={cn(
        COMMUNITY_ACTION,
        "relative overflow-visible",
        displayState.likedByMe ? "text-primary hover:bg-primary/10" : "text-muted-foreground",
        className,
      )}
      onClick={handleClick}
      aria-label={displayState.likedByMe ? "Unlike" : "Like"}
      aria-pressed={displayState.likedByMe}
      whileTap={reduceMotion ? undefined : { scale: 0.94 }}
      transition={{ type: "spring", stiffness: 520, damping: 28 }}
    >
      <span className="relative flex items-center justify-center">
        {!reduceMotion && displayState.likedByMe ? (
          <motion.span
            key={`ring-${burstKey}`}
            className="pointer-events-none absolute inset-0 rounded-full bg-primary/25"
            initial={{ scale: 0.6, opacity: 0.85 }}
            animate={{ scale: 2.2, opacity: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            aria-hidden
          />
        ) : null}

        <AnimatePresence mode="popLayout">
          {!reduceMotion && burstKey > 0 && displayState.likedByMe
            ? Array.from({ length: BURST_PARTICLES }, (_, i) => {
                const angle = (i / BURST_PARTICLES) * Math.PI * 2;
                const dx = Math.cos(angle) * 14;
                const dy = Math.sin(angle) * 14;
                return (
                  <motion.span
                    key={`${burstKey}-p-${i}`}
                    className="pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
                    initial={{ scale: 0, opacity: 1, x: 0, y: 0 }}
                    animate={{ scale: [0, 1.1, 0.4], opacity: [1, 1, 0], x: dx, y: dy }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.42, ease: "easeOut" }}
                    aria-hidden
                  />
                );
              })
            : null}
        </AnimatePresence>

        <span className="relative z-[1] flex items-center justify-center">
          <Heart
            className={cn(
              "h-5 w-5",
              COMMUNITY_ACTION_ICON,
              displayState.likedByMe && "fill-current text-primary",
            )}
          />
        </span>
      </span>

      <AnimatePresence mode="popLayout" initial={false}>
        {displayState.likeCount > 0 ? (
          <motion.span
            key={displayState.likeCount}
            className={cn("tabular-nums", countClassName)}
            initial={reduceMotion ? false : { opacity: 0, y: 4, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -4, scale: 0.85 }}
            transition={{ type: "spring", stiffness: 480, damping: 26 }}
          >
            {displayState.likeCount}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </motion.button>
  );
}
