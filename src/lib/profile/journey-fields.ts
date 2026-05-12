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
