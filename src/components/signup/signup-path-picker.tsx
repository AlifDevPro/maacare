"use client";

import { Bot, ListOrdered } from "lucide-react";
import { motion } from "framer-motion";

import { badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { SignupMode } from "./signup-mode-toggle";

type Props = {
  onPick: (mode: SignupMode) => void;
  manualTitle: string;
  manualDesc: string;
  aiTitle: string;
  aiDesc: string;
  aiBadge?: string;
};

function PathCard({
  onClick,
  icon: Icon,
  title,
  desc,
  badge,
  accentClass,
}: {
  onClick: () => void;
  icon: typeof ListOrdered;
  title: string;
  desc: string;
  badge?: string;
  accentClass: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        "relative flex min-h-[9.5rem] w-full flex-col items-center justify-center gap-2.5 overflow-hidden rounded-2xl border-2 border-border/60 bg-card/80 p-4 text-center transition-colors hover:border-primary/40 hover:bg-card hover:shadow-card sm:min-h-[10.5rem] sm:p-5",
      )}
    >
      <motion.div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b opacity-50",
          accentClass,
        )}
        aria-hidden
      />
      <span className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-border/50 bg-background text-primary shadow-soft">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <div className="relative space-y-0.5">
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <span className="font-display text-sm font-semibold tracking-tight text-foreground sm:text-base">
            {title}
          </span>
          {badge ? (
            <span
              className={cn(
                badgeVariants({ variant: "secondary" }),
                "px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide",
              )}
            >
              {badge}
            </span>
          ) : null}
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground sm:text-xs">{desc}</p>
      </div>
    </motion.button>
  );
}

export function SignupPathPicker({
  onPick,
  manualTitle,
  manualDesc,
  aiTitle,
  aiDesc,
  aiBadge,
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <PathCard
        onClick={() => onPick("manual")}
        icon={ListOrdered}
        title={manualTitle}
        desc={manualDesc}
        accentClass="from-primary-soft/80 to-transparent"
      />
      <PathCard
        onClick={() => onPick("ai")}
        icon={Bot}
        title={aiTitle}
        desc={aiDesc}
        badge={aiBadge}
        accentClass="from-accent-soft/80 to-transparent"
      />
    </div>
  );
}
