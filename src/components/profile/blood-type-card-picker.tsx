"use client";

import { BLOOD_TYPES } from "@/app/profile/profile-field-options";
import { cn } from "@/lib/utils";

function bloodLabel(value: string): string {
  if (value === "unknown") return "Not sure";
  return value;
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** Profile edit: first card clears selection (stored as empty). */
  allowUnset?: boolean;
};

export function BloodTypeCardPicker({ value, onChange, className, allowUnset = false }: Props) {
  const normalized = value || (allowUnset ? "" : "unknown");

  return (
    <div
      role="radiogroup"
      aria-label="Blood group"
      className={cn("grid grid-cols-3 gap-2 sm:grid-cols-5", className)}
    >
      {allowUnset ? (
        <BloodCard
          label="Not set"
          selected={normalized === "" || normalized === "__"}
          onClick={() => onChange("")}
        />
      ) : null}
      {BLOOD_TYPES.map((b) => (
        <BloodCard
          key={b}
          label={bloodLabel(b)}
          selected={normalized === b}
          onClick={() => onChange(b)}
        />
      ))}
    </div>
  );
}

function BloodCard({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "flex min-h-[2.75rem] items-center justify-center rounded-xl border px-2 py-2.5 text-center transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selected
          ? "border-primary bg-primary/10 font-semibold text-foreground shadow-sm"
          : "border-border/70 bg-card/80 text-muted-foreground hover:border-primary/35 hover:bg-muted/40",
      )}
    >
      <span className="text-sm leading-none tracking-tight">{label}</span>
    </button>
  );
}
