"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import type { ReactNode } from "react";

type Props = {
  contentKey: string;
  children: ReactNode;
  className?: string;
};

/** In-card step transition — morph / slide within the auth card. */
export function SignupMorphContent({ contentKey, children, className }: Props) {
  const reduced = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={contentKey}
        layout
        className={className}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.985 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.985 }}
        transition={{
          duration: reduced ? 0.15 : 0.38,
          ease: [0.32, 0.72, 0, 1],
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
