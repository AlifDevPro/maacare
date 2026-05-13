export const PRIMARY_USE_CASE_VALUES = [
  "self_maternal",
  "partner_support",
  "student_research",
  "clinician",
  "other_caregiver",
] as const;

export type PrimaryUseCaseValue = (typeof PRIMARY_USE_CASE_VALUES)[number];

export const PRIMARY_USE_LABEL: Record<PrimaryUseCaseValue, string> = {
  self_maternal: "Pregnant or postpartum (for myself)",
  partner_support: "Supporting someone who is pregnant",
  student_research: "Student or researcher",
  clinician: "Clinician using the app personally",
  other_caregiver: "Other caregiver / family",
};

const SET = new Set<string>(PRIMARY_USE_CASE_VALUES);

export function normalizePrimaryUseCase(value: string | null | undefined): PrimaryUseCaseValue {
  if (value && SET.has(value)) return value as PrimaryUseCaseValue;
  return "self_maternal";
}
