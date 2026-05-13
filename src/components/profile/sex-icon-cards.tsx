"use client";

import { cn } from "@/lib/utils";

export type SexOption = "female" | "male" | "other" | "unknown";
export type SexCardValue = SexOption | "";

type SexIconCardsProps = {
  value: SexCardValue | string;
  onChange: (next: SexCardValue) => void;
  className?: string;
  /** When true, first card clears selection (maps to "" / not specified). */
  allowUnset?: boolean;
};

function IconFemale({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="9" r="4" strokeLinecap="round" />
      <path d="M12 13v7M9 18h6" strokeLinecap="round" />
    </svg>
  );
}

function IconMale({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="11" cy="11" r="4" strokeLinecap="round" />
      <path d="M14.5 7.5L20 2M20 2h-4M20 2v4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconOther({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="9" cy="12" r="3.25" strokeLinecap="round" />
      <circle cx="15" cy="12" r="3.25" strokeLinecap="round" />
      <path d="M11.25 12h1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconUnknown({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="9" strokeLinecap="round" />
      <path d="M12 16.5v-.01M10.5 10.5a1.5 1.5 0 1 1 3 0c0 1-1.5 1.5-1.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconUnset({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="9" strokeDasharray="3 3" strokeLinecap="round" />
      <path d="M8 12h8" strokeLinecap="round" />
    </svg>
  );
}

const OPTIONS: {
  value: SexOption;
  label: string;
  Icon: typeof IconFemale;
}[] = [
  { value: "female", label: "Female", Icon: IconFemale },
  { value: "male", label: "Male", Icon: IconMale },
  { value: "other", label: "Other", Icon: IconOther },
  { value: "unknown", label: "Unknown", Icon: IconUnknown },
];

export function SexIconCards({ value, onChange, className, allowUnset = true }: SexIconCardsProps) {
  const normalized = (value || "") as SexCardValue;

  return (
    <div
      role="radiogroup"
      aria-label="Sex"
      className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3", className)}
    >
      {allowUnset ? (
        <button
          type="button"
          role="radio"
          aria-checked={normalized === ""}
          onClick={() => onChange("")}
          className={cn(
            "flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 text-center transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            normalized === ""
              ? "border-primary bg-primary/10 text-foreground shadow-sm"
              : "border-border/70 bg-card/60 text-muted-foreground hover:border-primary/40 hover:bg-muted/40",
          )}
        >
          <IconUnset className="h-8 w-8 shrink-0" />
          <span className="text-xs font-medium leading-tight">Prefer not to say</span>
        </button>
      ) : null}
      {OPTIONS.map(({ value: v, label, Icon }) => {
        const selected = normalized === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(v)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 text-center transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              selected
                ? "border-primary bg-primary/10 text-foreground shadow-sm"
                : "border-border/70 bg-card/60 text-muted-foreground hover:border-primary/40 hover:bg-muted/40",
            )}
          >
            <Icon className="h-8 w-8 shrink-0" />
            <span className="text-xs font-medium capitalize leading-tight">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
