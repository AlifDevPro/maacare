"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function ProfileMenuSegmentGroup({
  children,
  className,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("flex gap-1 rounded-lg bg-muted/60 p-1", className)}
    >
      {children}
    </div>
  );
}

export function ProfileMenuSegment({
  active,
  onClick,
  children,
  className,
  "aria-label": ariaLabel,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors touch-manipulation",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function ProfileMenuIconSegment({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <ProfileMenuSegment active={active} onClick={onClick} aria-label={label} className="px-1.5">
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="sr-only sm:not-sr-only sm:text-[11px]">{label}</span>
    </ProfileMenuSegment>
  );
}
