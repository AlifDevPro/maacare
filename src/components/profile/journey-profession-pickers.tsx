"use client";

import type { LucideIcon } from "lucide-react";
import { Baby, Heart, Sparkles, Stethoscope, UserCircle, XCircle } from "lucide-react";

import { PREGNANCY_STATUS_OPTIONS } from "@/app/profile/profile-field-options";
import type { PregnancyJourneyStatus } from "@/lib/profile/journey-fields";
import { PROFESSION_VALUES, type ProfessionValue } from "@/lib/profile/profession-values";
import { cn } from "@/lib/utils";

export { PROFESSION_VALUES };
export type { ProfessionValue };

const JOURNEY_UI: Record<
  PregnancyJourneyStatus,
  { title: string; description: string; icon: LucideIcon }
> = {
  pregnant: {
    title: "Pregnant",
    description: "Track weeks, appointments, and daily guidance.",
    icon: Baby,
  },
  planning: {
    title: "Planning",
    description: "Preparing for pregnancy — optional cycle context.",
    icon: Sparkles,
  },
  postpartum: {
    title: "Postpartum",
    description: "Recovery and baby care after birth.",
    icon: Heart,
  },
  not_applicable: {
    title: "Not applicable",
    description: "No pregnancy journey on MaaCare right now.",
    icon: XCircle,
  },
};

const PROFESSION_UI: Record<
  ProfessionValue,
  { title: string; description: string; icon: LucideIcon }
> = {
  parent_caregiver: {
    title: "Parent or caregiver",
    description: "Using MaaCare for myself or my family.",
    icon: Heart,
  },
  clinician: {
    title: "Clinician",
    description: "Doctor, midwife, nurse, or other provider.",
    icon: Stethoscope,
  },
  other: {
    title: "Other",
    description: "Student, researcher, or another role.",
    icon: UserCircle,
  },
};

export function JourneyStatusPicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: PregnancyJourneyStatus) => void;
  className?: string;
}) {
  return (
    <div className={cn("grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2", className)}>
      {PREGNANCY_STATUS_OPTIONS.map((key) => {
        const meta = JOURNEY_UI[key];
        const Icon = meta.icon;
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={cn(
              "flex min-w-0 w-full flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 sm:focus-visible:ring-offset-2",
              selected
                ? "border-primary bg-primary-soft/80 shadow-sm"
                : "border-border bg-card/60 hover:border-primary/40 hover:bg-muted/40",
            )}
          >
            <span
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-xl",
                selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <span className="font-display text-base font-semibold text-foreground">{meta.title}</span>
            <span className="text-xs leading-snug text-muted-foreground">{meta.description}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ProfessionPicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: ProfessionValue) => void;
  className?: string;
}) {
  return (
    <div className={cn("grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3", className)}>
      {PROFESSION_VALUES.map((key) => {
        const meta = PROFESSION_UI[key];
        const Icon = meta.icon;
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={cn(
              "flex min-w-0 w-full flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 sm:focus-visible:ring-offset-2 sm:min-h-[8.5rem]",
              selected
                ? "border-primary bg-primary-soft/80 shadow-sm"
                : "border-border bg-card/60 hover:border-primary/40 hover:bg-muted/40",
            )}
          >
            <span
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <span className="font-display text-sm font-semibold text-foreground">{meta.title}</span>
            <span className="text-[11px] leading-snug text-muted-foreground">{meta.description}</span>
          </button>
        );
      })}
    </div>
  );
}
