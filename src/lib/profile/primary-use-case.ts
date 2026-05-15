import type { ProfessionValue } from "@/lib/profile/profession-values";

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

/** Primary-focus options shown per self-reported role (profile edit). */
export const PRIMARY_USE_BY_PROFESSION: Record<ProfessionValue, readonly PrimaryUseCaseValue[]> = {
  parent_caregiver: ["self_maternal", "partner_support", "other_caregiver"],
  clinician: ["clinician"],
  student_researcher: ["student_research"],
};

export function primaryUseOptionsForProfession(profession: ProfessionValue | "") {
  const keys =
    profession && profession in PRIMARY_USE_BY_PROFESSION
      ? PRIMARY_USE_BY_PROFESSION[profession as ProfessionValue]
      : PRIMARY_USE_CASE_VALUES;
  return keys.map((k) => ({ value: k, label: PRIMARY_USE_LABEL[k] }));
}

export function defaultPrimaryUseForProfession(profession: ProfessionValue): PrimaryUseCaseValue {
  return PRIMARY_USE_BY_PROFESSION[profession][0]!;
}
