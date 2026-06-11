"use client";

import { Crown } from "lucide-react";

import { cn } from "@/lib/utils";

type PremiumBadgeProps = {
  className?: string;
  compact?: boolean;
};

export function PremiumBadge({ className, compact }: PremiumBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300",
        className,
      )}
    >
      <Crown className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
      Premium
    </span>
  );
}
