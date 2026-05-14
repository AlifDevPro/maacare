"use client";

import { cn } from "@/lib/utils";

export function StepProgressRail({
  label,
  percent,
  className,
}: {
  label: string;
  percent: number;
  className?: string;
}) {
  const p = Math.min(100, Math.max(0, percent));
  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <p className="min-w-0 max-sm:truncate text-xs font-medium text-muted-foreground sm:whitespace-normal">
          {label}
        </p>
        <span className="shrink-0 text-xs text-muted-foreground">{Math.round(p)}%</span>
      </div>
      <div className="h-1.5 w-full min-w-0 rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}
