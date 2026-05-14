"use client";

import type { LucideIcon } from "lucide-react";
import { Baby, GraduationCap, Heart, Sparkles, Stethoscope, XCircle } from "lucide-react";

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
  student_researcher: {
    title: "Student or researcher",
    description: "Studying, researching, or exploring maternal health topics.",
    icon: GraduationCap,
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
  size = "default",
}: {
  value: string;
  onChange: (v: ProfessionValue) => void;
  className?: string;
  /** Larger tap targets and typography for onboarding persona step. */
  size?: "default" | "prominent";
}) {
  const prominent = size === "prominent";
  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-1 gap-3",
        prominent ? "sm:grid-cols-3" : "sm:grid-cols-3",
        className,
      )}
      role="group"
      aria-label="Choose how you use MaaCare"
    >
      {PROFESSION_VALUES.map((key) => {
        const meta = PROFESSION_UI[key];
        const Icon = meta.icon;
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(key)}
            className={cn(
              "flex min-w-0 w-full flex-col items-start gap-2 border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 sm:focus-visible:ring-offset-2",
              prominent
                ? "rounded-lg border-2 p-4 sm:min-h-[10rem]"
                : "rounded-xl border p-3.5 sm:min-h-[8.5rem]",
              selected
                ? "border-primary bg-primary-soft/80 shadow-sm"
                : "border-border bg-card/60 hover:border-primary/40 hover:bg-muted/40",
            )}
          >
            <span
              className={cn(
                "flex items-center justify-center rounded-lg",
                prominent ? "h-14 w-14" : "h-10 w-10",
                selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
              )}
            >
              <Icon className={prominent ? "h-7 w-7" : "h-5 w-5"} aria-hidden />
            </span>
            <span
              className={cn(
                "font-display font-semibold text-foreground",
                prominent ? "text-base sm:text-lg" : "text-sm",
              )}
            >
              {meta.title}
            </span>
            <span
              className={cn("leading-snug text-muted-foreground", prominent ? "text-sm" : "text-[11px]")}
            >
              {meta.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
