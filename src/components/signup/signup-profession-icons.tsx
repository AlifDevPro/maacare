import { cn } from "@/lib/utils";

import type { ProfessionValue } from "@/lib/profile/profession-values";

const S = 1.75;
const CAP = "round" as const;
const JOIN = "round" as const;

type IconProps = { className?: string };

/** Parent / caregiver — figure holding baby */
export function SignupParentIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={cn("h-7 w-7", className)}>
      <circle cx="12.5" cy="8.5" r="3" stroke="currentColor" strokeWidth={S} />
      <path
        d="M6.5 26c0-4.2 2.7-7 6-7s6 2.8 6 7"
        stroke="currentColor"
        strokeWidth={S}
        strokeLinecap={CAP}
        strokeLinejoin={JOIN}
      />
      <path
        d="M15 17.5c2.5-1.5 5-1.5 7.5 0"
        stroke="currentColor"
        strokeWidth={S}
        strokeLinecap={CAP}
      />
      <circle cx="21" cy="13.5" r="2.35" stroke="currentColor" strokeWidth={1.55} />
      <path
        d="M18.5 17.5v1.5c0 2.2 1.2 3.8 2.5 5 2.2-1.5 3.5-3.5 3.5-6v-1.5"
        stroke="currentColor"
        strokeWidth={1.55}
        strokeLinecap={CAP}
        strokeLinejoin={JOIN}
      />
    </svg>
  );
}

/** Clinician — stethoscope */
export function SignupClinicianIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={cn("h-7 w-7", className)}>
      <path
        d="M9 8.5c0-1.4 1.1-2.5 2.5-2.5S14 7.1 14 8.5v3.5c0 3.9-2.1 7.5-5.5 9.5"
        stroke="currentColor"
        strokeWidth={S}
        strokeLinecap={CAP}
      />
      <path
        d="M23 8.5c0-1.4 1.1-2.5 2.5-2.5s2.5 1.1 2.5 2.5v3.5c0 3.9-2.1 7.5-5.5 9.5"
        stroke="currentColor"
        strokeWidth={S}
        strokeLinecap={CAP}
      />
      <path
        d="M11.5 21.5h9"
        stroke="currentColor"
        strokeWidth={S}
        strokeLinecap={CAP}
      />
      <circle cx="16" cy="23.5" r="3.25" stroke="currentColor" strokeWidth={S} />
      <path d="M16 20.25V17" stroke="currentColor" strokeWidth={S} strokeLinecap={CAP} />
    </svg>
  );
}

/** Student / researcher — graduation cap + open book */
export function SignupStudentIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={cn("h-7 w-7", className)}>
      <path
        d="M6 13 16 8l10 5-10 5-10-5Z"
        stroke="currentColor"
        strokeWidth={S}
        strokeLinejoin={JOIN}
      />
      <path d="M23 13v5.5c0 1.8-3.2 3.5-7 3.5s-7-1.7-7-3.5V13" stroke="currentColor" strokeWidth={S} strokeLinecap={CAP} />
      <path
        d="M9 24.5h14a1.5 1.5 0 0 1 1.5 1.5V27H7.5v-1a1.5 1.5 0 0 1 1.5-1.5Z"
        stroke="currentColor"
        strokeWidth={S}
        strokeLinejoin={JOIN}
      />
      <path d="M16 18v9" stroke="currentColor" strokeWidth={S} strokeLinecap={CAP} />
      <path d="M12 27h8" stroke="currentColor" strokeWidth={S} strokeLinecap={CAP} />
    </svg>
  );
}

export const SIGNUP_PROFESSION_ICON: Record<
  ProfessionValue,
  { Icon: typeof SignupParentIcon }
> = {
  parent_caregiver: { Icon: SignupParentIcon },
  clinician: { Icon: SignupClinicianIcon },
  student_researcher: { Icon: SignupStudentIcon },
};
