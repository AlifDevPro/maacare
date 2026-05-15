"use client";

import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

export type LoginAuthLockPhase = "authenticating" | "success";

type Props = {
  phase: LoginAuthLockPhase;
  authenticatingLabel: string;
  successLabel: string;
  className?: string;
};

/**
 * Single-hinge padlock: shackle pivots only at the left foot (20, 40).
 * Unlock = rotate open from that one point — no lift on both legs.
 */
const PIVOT_X = 20;
const PIVOT_Y = 40;

export function LoginAuthLockOverlay({
  phase,
  authenticatingLabel,
  successLabel,
  className,
}: Props) {
  const reduced = useReducedMotion();
  const unlocked = phase === "success";
  const label = unlocked ? successLabel : authenticatingLabel;

  return (
    <motion.div
      className={cn(
        "flex flex-col items-center justify-center gap-4 py-8",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy={!unlocked}
    >
      <svg
        viewBox="0 0 72 88"
        className="h-[5.5rem] w-[5.5rem] text-primary"
        fill="none"
        aria-hidden
      >
        {/* Shackle — rotates around left hinge only */}
        <motion.g
          initial={false}
          animate={{ rotate: unlocked ? -58 : 0 }}
          transition={
            reduced
              ? { duration: 0.2 }
              : {
                  type: "spring",
                  stiffness: 300,
                  damping: 22,
                }
          }
          style={{
            transformOrigin: `${PIVOT_X}px ${PIVOT_Y}px`,
            transformBox: "view-box",
          }}
        >
          <path
            d="M20 40 V24 C20 14.06 27.06 7 37 7 C46.94 7 54 14.06 54 24 V40"
            stroke="currentColor"
            strokeWidth="3.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </motion.g>

        {/* Body covers shackle feet */}
        <rect
          x="11"
          y="36"
          width="50"
          height="44"
          rx="9"
          stroke="currentColor"
          strokeWidth="2.75"
          fill="currentColor"
          fillOpacity={0.1}
        />
        <path
          d="M11 44 H61"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeOpacity={0.35}
        />

        {/* Right latch slot — hidden when open */}
        <motion.rect
          x="50"
          y="38"
          width="5"
          height="7"
          rx="1"
          fill="currentColor"
          initial={false}
          animate={{ opacity: unlocked ? 0 : 0.5 }}
          transition={{ duration: 0.15 }}
        />

        {/* Keyhole */}
        <motion.g
          initial={false}
          animate={{ opacity: unlocked ? 0 : 1 }}
          transition={{ duration: 0.18 }}
        >
          <circle cx="36" cy="56" r="4.5" fill="currentColor" />
          <path
            d="M36 60.5 V68"
            stroke="currentColor"
            strokeWidth="2.75"
            strokeLinecap="round"
          />
        </motion.g>
      </svg>

      <motion.p
        key={label}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="text-center text-sm font-medium text-foreground"
      >
        {label}
      </motion.p>

      {!unlocked && !reduced ? (
        <motion.div className="flex gap-1.5" aria-hidden initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-primary/55"
              animate={{ opacity: [0.35, 1, 0.35] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.16 }}
            />
          ))}
        </motion.div>
      ) : null}
    </motion.div>
  );
}

export function loginUnlockRedirectMs(reducedMotion: boolean | null): number {
  return reducedMotion ? 320 : 1000;
}
