"use client";

import { Bot, ListOrdered } from "lucide-react";

import { badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type SignupMode = "manual" | "ai";

export function SignupModeToggle({
  mode,
  onChange,
}: {
  mode: SignupMode;
  onChange: (m: SignupMode) => void;
}) {
  return (
    <div className="mb-4 flex w-full gap-0 border-b border-border/60">
      <button
        type="button"
        onClick={() => onChange("manual")}
        className={cn(
          "flex flex-1 items-center justify-center gap-2 border-b-2 py-3 text-sm font-medium transition-colors",
          mode === "manual"
            ? "border-primary text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground/80",
        )}
      >
        <ListOrdered className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
        Manual
      </button>
      <button
        type="button"
        onClick={() => onChange("ai")}
        className={cn(
          "flex flex-1 items-center justify-center gap-2 border-b-2 py-3 text-sm font-medium transition-colors",
          mode === "ai"
            ? "border-primary text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground/80",
        )}
      >
        <Bot className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
        <span className="inline-flex min-w-0 items-center gap-2">
          <span className="truncate">Register with AI</span>
          <span
            className={cn(
              badgeVariants({ variant: "secondary" }),
              "shrink-0 px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide",
            )}
          >
            Beta
          </span>
        </span>
      </button>
    </div>
  );
}
