import { normalizePrimaryUseCase } from "@/lib/profile/primary-use-case";

/**
 * Partner / support accounts do not use a new `pregnancy_status` enum value.
 * Use `primary_use_case = partner_support` with `not_applicable` here; see docs/persona-care-privacy.md.
 */
export type PregnancyJourneyStatus = "planning" | "pregnant" | "postpartum" | "not_applicable";

export type PregnancyFieldVisibility = {
  showLmpEdd: boolean;
  showGestationalWeek: boolean;
  showBabyBirth: boolean;
  showGravidaPara: boolean;
};

const HIDDEN: PregnancyFieldVisibility = {
  showLmpEdd: false,
  showGestationalWeek: false,
  showBabyBirth: false,
  showGravidaPara: false,
};

/** Male users track a partner via care links — not LMP / EDD on their own row. */
export function userExcludesOwnPregnancyTracking(sex: string | null | undefined): boolean {
  return sex === "male";
}

export function userCanTrackOwnPregnancy(sex: string | null | undefined): boolean {
  return !userExcludesOwnPregnancyTracking(sex);
}

/** Pregnancy physiology fields (LMP, EDD, etc.) for the signed-in user's own row. */
export function pregnancyFieldVisibility(status: string): PregnancyFieldVisibility {
  switch (status) {
    case "not_applicable":
      return HIDDEN;
    case "planning":
      return {
        showLmpEdd: true,
        showGestationalWeek: false,
        showBabyBirth: false,
        showGravidaPara: true,
      };
    case "pregnant":
      return {
        showLmpEdd: true,
        showGestationalWeek: true,
        showBabyBirth: false,
        showGravidaPara: true,
      };
    case "postpartum":
      return {
        showLmpEdd: false,
        showGestationalWeek: false,
        showBabyBirth: true,
        showGravidaPara: true,
      };
    default:
      return {
        showLmpEdd: true,
        showGestationalWeek: true,
        showBabyBirth: true,
        showGravidaPara: true,
      };
  }
}

/**
 * Pregnancy physiology fields for the signed-in user's own row.
 * Partners track the expectant person via care links, not a second pregnancy profile.
 */
export function resolveProfileFieldVisibility(
  status: string,
  primaryUseCase: string | null | undefined,
  sex?: string | null | undefined,
): PregnancyFieldVisibility {
  if (!userCanTrackOwnPregnancy(sex)) {
    return HIDDEN;
  }
  const use = normalizePrimaryUseCase(primaryUseCase);
  if (use === "partner_support") {
    return HIDDEN;
  }
  return pregnancyFieldVisibility(status);
}

/** Whether signup / profile edit should show journey + pregnancy detail steps. */
export function shouldCollectOwnPregnancyJourney(
  profession: string | null | undefined,
  primaryUseCase: string | null | undefined,
  sex: string | null | undefined,
): boolean {
  if (profession !== "parent_caregiver") return false;
  if (!userCanTrackOwnPregnancy(sex)) return false;
  return normalizePrimaryUseCase(primaryUseCase) !== "partner_support";
}

/** Apply sex-appropriate defaults when sex or role changes in forms. */
export function applySexAwareProfileDefaults(input: {
  sex: string | null | undefined;
  primaryUseCase: string | null | undefined;
  pregnancyStatus: string;
}): { primaryUseCase: string; pregnancyStatus: string } {
  const use = normalizePrimaryUseCase(input.primaryUseCase);
  if (!userCanTrackOwnPregnancy(input.sex)) {
    return {
      primaryUseCase: use === "self_maternal" ? "partner_support" : use,
      pregnancyStatus: "not_applicable",
    };
  }
  return { primaryUseCase: use, pregnancyStatus: input.pregnancyStatus };
}
