import { normalizePrimaryUseCase } from "@/lib/profile/primary-use-case";

/**
 * Partner / support accounts do not use a new `pregnancy_status` enum value.
 * Use `primary_use_case = partner_support` with `not_applicable` here; see docs/persona-care-privacy.md.
 */
export type PregnancyJourneyStatus = "planning" | "pregnant" | "postpartum" | "not_applicable";

/** Which pregnancy-detail inputs are relevant for a given journey status. */
export function pregnancyFieldVisibility(status: string) {
  switch (status) {
    case "not_applicable":
      return {
        showLmpEdd: false,
        showGestationalWeek: false,
        showBabyBirth: false,
        showGravidaPara: false,
      };
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
 * Pregnancy physiology fields (LMP, EDD, etc.) for the signed-in user's own row.
 * Partners track the expectant person via care links, not a second pregnancy profile.
 */
export function resolveProfileFieldVisibility(status: string, primaryUseCase: string | null | undefined) {
  const use = normalizePrimaryUseCase(primaryUseCase);
  if (use === "partner_support") {
    return {
      showLmpEdd: false,
      showGestationalWeek: false,
      showBabyBirth: false,
      showGravidaPara: false,
    };
  }
  return pregnancyFieldVisibility(status);
}
