"use client";

import Link from "next/link";
import { GraduationCap, Heart, Shield, Stethoscope } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type CommunityAuthorBadgeProps = {
  authorId?: string;
  authorDisplayName: string;
  authorRole: string;
  authorProfession?: string | null;
  authorVerifiedProfessional?: boolean;
  /** Relative time label, e.g. "5 minutes ago" */
  timeLabel?: string | null;
  nameClassName?: string;
  /** Larger badges and name for feed / post headers */
  variant?: "default" | "prominent";
};

export function authorRowHighlightClass(
  authorProfession: string | null | undefined,
  authorVerifiedProfessional?: boolean,
): string {
  const verifiedDoctor = authorVerifiedProfessional === true && authorProfession === "clinician";
  return verifiedDoctor ? "border border-sky-500/35 bg-sky-500/[0.06] px-2.5 py-2 sm:px-3 rounded-xl" : "";
}

export function CommunityAuthorBadges({
  authorId,
  authorDisplayName,
  authorRole,
  authorProfession,
  authorVerifiedProfessional,
  timeLabel,
  nameClassName,
  variant = "default",
}: CommunityAuthorBadgeProps) {
  const verifiedDoctor = authorVerifiedProfessional === true && authorProfession === "clinician";
  const prominent = variant === "prominent";
  const nameCls = cn(
    "truncate font-bold leading-tight text-foreground hover:underline",
    prominent ? "text-base sm:text-lg" : "text-[15px] sm:text-base",
    nameClassName,
  );
  const timeCls = prominent ? "text-sm text-muted-foreground tabular-nums" : "text-[13px] text-muted-foreground tabular-nums sm:text-sm";
  const badgeBase = prominent
    ? "h-7 gap-1 px-2 text-xs font-semibold uppercase sm:h-7"
    : "h-5 gap-0.5 px-1.5 text-[10px] font-semibold uppercase";
  const iconSm = prominent ? "h-4 w-4" : "h-3 w-3";

  const nameEl = authorId ? (
    <Link href={`/community/member/${authorId}`} className={nameCls}>
      {authorDisplayName}
    </Link>
  ) : (
    <span className={nameCls}>{authorDisplayName}</span>
  );

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      {nameEl}
      {timeLabel ? <span className={timeCls}>· {timeLabel}</span> : null}
      {authorRole === "admin" ? (
        <Badge
          variant="outline"
          className={cn(
            badgeBase,
            "border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-100",
          )}
        >
          <Shield className={iconSm} aria-hidden />
          Admin
        </Badge>
      ) : null}
      {authorRole === "moderator" ? (
        <Badge variant="outline" className={badgeBase}>
          Mod
        </Badge>
      ) : null}
      {verifiedDoctor ? (
        <Badge
          variant="outline"
          className={cn(badgeBase, "border-sky-500/50 bg-sky-500/10 text-sky-900 dark:text-sky-100")}
        >
          <Stethoscope className={iconSm} aria-hidden />
          Verified clinician
        </Badge>
      ) : authorProfession === "clinician" ? (
        <Badge variant="outline" className={cn(badgeBase, "border-border/80 text-muted-foreground")}>
          <Stethoscope className={iconSm} aria-hidden />
          Clinician
        </Badge>
      ) : null}
      {authorProfession === "student_researcher" ? (
        <Badge variant="outline" className={cn(badgeBase, "border-violet-500/40 bg-violet-500/10 text-violet-950 dark:text-violet-100")}>
          <GraduationCap className={iconSm} aria-hidden />
          Student / researcher
        </Badge>
      ) : null}
      {authorProfession === "parent_caregiver" && prominent ? (
        <Badge variant="outline" className={cn(badgeBase, "border-rose-500/35 bg-rose-500/[0.07] text-rose-950 dark:text-rose-50")}>
          <Heart className={iconSm} aria-hidden />
          Parent / caregiver
        </Badge>
      ) : null}
    </div>
  );
}
