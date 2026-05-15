"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { PROFESSION_VALUES, type ProfessionValue } from "@/lib/profile/profession-values";
import { cn } from "@/lib/utils";

import { SIGNUP_PROFESSION_ICON } from "./signup-profession-icons";

type Props = {
  value: string;
  onChange: (v: ProfessionValue) => void;
  className?: string;
};

export function SignupProfessionPicker({ value, onChange, className }: Props) {
  const { t } = useTranslation("auth");

  const copy = useMemo(
    (): Record<ProfessionValue, { title: string; description: string }> => ({
      parent_caregiver: {
        title: t("signup_profession_parent_title"),
        description: t("signup_profession_parent_desc"),
      },
      clinician: {
        title: t("signup_profession_clinician_title"),
        description: t("signup_profession_clinician_desc"),
      },
      student_researcher: {
        title: t("signup_profession_student_title"),
        description: t("signup_profession_student_desc"),
      },
    }),
    [t],
  );

  return (
    <div
      className={cn("grid min-w-0 grid-cols-1 gap-2.5", className)}
      role="group"
      aria-label="Choose how you use MaaCare"
    >
      {PROFESSION_VALUES.map((key) => {
        const meta = copy[key];
        const { Icon } = SIGNUP_PROFESSION_ICON[key];
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(key)}
            className={cn(
              "flex min-w-0 w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              selected
                ? "border-primary bg-primary-soft/50"
                : "border-border bg-card hover:border-primary/25 hover:bg-muted/40",
            )}
          >
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                selected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
              )}
            >
              <Icon />
            </span>
            <span className="min-w-0 space-y-0.5 pt-0.5">
              <span className="block text-sm font-semibold leading-snug text-foreground">
                {meta.title}
              </span>
              <span className="block text-[11px] leading-snug text-muted-foreground">
                {meta.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
