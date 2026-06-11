"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Shield, Stethoscope } from "lucide-react";

import { cn } from "@/lib/utils";

export type CommunityAuthorBadgeProps = {
  authorId?: string;
  authorDisplayName: string;
  authorRole: string;
  authorProfession?: string | null;
  authorVerifiedProfessional?: boolean;
  timeLabel?: string | null;
  nameClassName?: string;
  variant?: "default" | "prominent";
};

type RoleAccent = "admin" | "moderator" | "doctor";

const ROLE_ACCENT_STYLES: Record<
  RoleAccent,
  { iconClass: string; labelClass: string }
> = {
  admin: {
    iconClass: "text-violet-600 dark:text-violet-400",
    labelClass: "text-violet-700/90 dark:text-violet-300",
  },
  moderator: {
    iconClass: "text-amber-600 dark:text-amber-400",
    labelClass: "text-amber-800/90 dark:text-amber-200",
  },
  doctor: {
    iconClass: "text-emerald-600 dark:text-emerald-400",
    labelClass: "text-emerald-800/90 dark:text-emerald-200",
  },
};

function RoleMeta({
  icon: Icon,
  label,
  accent,
  prominent,
}: {
  icon: LucideIcon;
  label: string;
  accent: RoleAccent;
  prominent?: boolean;
}) {
  const styles = ROLE_ACCENT_STYLES[accent];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-medium leading-none sm:text-xs",
        styles.labelClass,
      )}
    >
      <Icon
        className={cn(
          "shrink-0",
          prominent ? "h-3.5 w-3.5" : "h-3 w-3",
          styles.iconClass,
        )}
        aria-hidden
      />
      {label}
    </span>
  );
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
  const prominent = variant === "prominent";
  const verifiedDoctor = authorVerifiedProfessional === true && authorProfession === "clinician";
  const nameCls = cn(
    "truncate font-semibold leading-tight text-foreground hover:underline",
    "text-[15px] sm:text-base",
    nameClassName,
  );
  const timeCls = "text-[12px] text-muted-foreground tabular-nums sm:text-[13px]";

  const nameEl = authorId ? (
    <Link href={`/community/member/${authorId}`} className={nameCls}>
      {authorDisplayName}
    </Link>
  ) : (
    <span className={nameCls}>{authorDisplayName}</span>
  );

  let roleMeta: ReactNode = null;
  if (authorRole === "admin") {
    roleMeta = <RoleMeta icon={Shield} label="Admin" accent="admin" prominent={prominent} />;
  } else if (authorRole === "moderator") {
    roleMeta = <RoleMeta icon={Shield} label="Moderator" accent="moderator" prominent={prominent} />;
  } else if (verifiedDoctor) {
    roleMeta = (
      <RoleMeta icon={Stethoscope} label="Verified doctor" accent="doctor" prominent={prominent} />
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {nameEl}
        {timeLabel ? <span className={timeCls}>· {timeLabel}</span> : null}
      </div>
      {roleMeta ? <div className="flex flex-wrap items-center gap-x-2">{roleMeta}</div> : null}
    </div>
  );
}
