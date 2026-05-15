"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { GraduationCap, Shield, Stethoscope } from "lucide-react";

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

const metaCls =
  "inline-flex items-center gap-1 text-[11px] font-medium leading-none text-muted-foreground sm:text-xs";

function RoleMeta({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className={metaCls}>
      <Icon className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
      {label}
    </span>
  );
}

export function authorRowHighlightClass(
  authorProfession: string | null | undefined,
  authorVerifiedProfessional?: boolean,
): string {
  const verifiedDoctor = authorVerifiedProfessional === true && authorProfession === "clinician";
  return verifiedDoctor ? "rounded-xl bg-muted/30" : "";
}

export function CommunityAuthorBadges({
  authorId,
  authorDisplayName,
  authorRole,
  authorProfession,
  authorVerifiedProfessional,
  timeLabel,
  nameClassName,
}: CommunityAuthorBadgeProps) {
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
    roleMeta = <RoleMeta icon={Shield} label="Admin" />;
  } else if (authorRole === "moderator") {
    roleMeta = <RoleMeta icon={Shield} label="Moderator" />;
  } else if (verifiedDoctor) {
    roleMeta = <RoleMeta icon={Stethoscope} label="Verified clinician" />;
  } else if (authorProfession === "clinician") {
    roleMeta = <RoleMeta icon={Stethoscope} label="Clinician" />;
  } else if (authorProfession === "student_researcher") {
    roleMeta = <RoleMeta icon={GraduationCap} label="Student" />;
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

