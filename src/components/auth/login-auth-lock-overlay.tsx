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

const PIVOT_X = 22;
const PIVOT_Y = 39;

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
        viewBox="0 0 80 96"
        className="h-[5.5rem] w-[5.5rem] text-primary"
        fill="none"
        aria-hidden
      >
        {/* Shackle: lift slightly, then open from left hinge. */}
        <motion.g
          initial={false}
          animate={
            unlocked
              ? reduced
                ? { rotate: -42, y: -1 }
                : { rotate: [-2, -6, -42], y: [0, -4, -1] }
              : { rotate: 0, y: 0 }
          }
          transition={
            reduced
              ? { duration: 0.2 }
              : {
                  duration: 0.62,
                  ease: [0.22, 0.8, 0.2, 1],
                }
          }
          style={{
            transformOrigin: `${PIVOT_X}px ${PIVOT_Y}px`,
            transformBox: "view-box",
          }}
        >
          <path
            d="M22 39 V24.5 C22 14.7 29.2 8 39.5 8 C49.8 8 57 14.7 57 24.5 V39"
            stroke="currentColor"
            strokeWidth="3.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </motion.g>

        {/* Body */}
        <motion.rect
          initial={false}
          animate={unlocked && !reduced ? { y: [0, 1.2, 0] } : { y: 0 }}
          transition={{ duration: 0.34, ease: "easeOut" }}
          x="12"
          y="36"
          width="55"
          height="46"
          rx="9"
          stroke="currentColor"
          strokeWidth="2.75"
          fill="currentColor"
          fillOpacity={0.1}
        />
        <path
          d="M12 45 H67"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeOpacity={0.35}
        />

        {/* Latch notch fades as it unlocks */}
        <motion.rect
          x="55"
          y="38.5"
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
          <circle cx="40" cy="57" r="4.7" fill="currentColor" />
          <path
            d="M40 61.7 V70"
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
