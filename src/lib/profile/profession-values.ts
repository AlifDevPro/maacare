/** Shared with server routes and client UI — do not import from `"use client"` modules into API handlers. */
export const PROFESSION_VALUES = ["parent_caregiver", "clinician", "student_researcher"] as const;
export type ProfessionValue = (typeof PROFESSION_VALUES)[number];

/** Legacy DB/API value → current profession slug. */
export function normalizeProfessionValue(raw: string | null | undefined): ProfessionValue | null {
  const t = (raw ?? "").trim().toLowerCase();
  if (!t) return null;
  if (t === "other" || t === "student_researcher") return "student_researcher";
  if (t === "parent_caregiver" || t === "clinician") return t;
  return null;
}

/** Pregnancy journey + shared access editing is for parents/caregivers only. */
export function canEditPregnancyProfile(
  profession: ProfessionValue | "" | null | undefined,
): boolean {
  return profession === "parent_caregiver";
}
