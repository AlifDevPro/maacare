import { Sparkles } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type SymptomsAiSkeletonProps = {
  loadingLabel: string;
};

export function SymptomsAiInsightSkeleton({ loadingLabel }: SymptomsAiSkeletonProps) {
  return (
    <Card
      className="relative overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/[0.09] via-card to-sky-500/[0.06] p-4 shadow-soft backdrop-blur-[2px]"
      aria-busy="true"
      aria-label={loadingLabel}
    >
      <div className="maacare-ai-shimmer-sweep" aria-hidden />
      <div className="relative">
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-violet-500/25 bg-background/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 shadow-sm dark:text-violet-200">
          <Sparkles className="h-3 w-3 animate-pulse" aria-hidden />
          AI
        </div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-violet-600/70 dark:text-violet-300/70">
          {loadingLabel}
        </p>
        <Skeleton className="mb-2 h-4 w-36" />
        <Skeleton className="mb-2 h-3 w-48" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-[92%]" />
          <Skeleton className="h-3 w-[85%]" />
          <Skeleton className="h-3 w-[70%]" />
        </div>
      </div>
    </Card>
  );
}

export function SymptomsAiSuggestionsSkeleton({ loadingLabel }: SymptomsAiSkeletonProps) {
  return (
    <Card
      className="relative overflow-hidden rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-500/[0.08] via-card to-muted/50 p-4 shadow-soft backdrop-blur-[2px]"
      aria-busy="true"
      aria-label={loadingLabel}
    >
      <div className="maacare-ai-shimmer-sweep" aria-hidden />
      <div className="relative">
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-sky-500/25 bg-background/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800 shadow-sm dark:text-sky-100">
          <Sparkles className="h-3 w-3 animate-pulse" aria-hidden />
          AI
        </div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-sky-700/70 dark:text-sky-200/70">
          {loadingLabel}
        </p>
        <Skeleton className="mb-3 h-4 w-40" />
        <ul className="space-y-2.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-start gap-2.5">
              <Skeleton className="mt-0.5 h-4 w-4 shrink-0 rounded-full" />
              <Skeleton className="h-3.5 flex-1" style={{ maxWidth: `${88 - i * 8}%` }} />
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
