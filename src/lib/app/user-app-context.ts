import { userCanTrackOwnPregnancy } from "@/lib/profile/journey-fields";
import type { PrimaryUseCaseValue } from "@/lib/profile/primary-use-case";
import { normalizePrimaryUseCase } from "@/lib/profile/primary-use-case";

export type UserAppContext = {
  primaryUseCase: PrimaryUseCaseValue;
  isPartnerSupport: boolean;
  isStudentResearch: boolean;
  isClinicianPersona: boolean;
};

export type HomeUiVisibility = {
  showPregnancyJourney: boolean;
  showVitalsCard: boolean;
  showSymptomShortcut: boolean;
  showPlannerShortcut: boolean;
  showPostpartumShortcut: boolean;
  showStudentFields: boolean;
  showClinicianFields: boolean;
  showPartnerConnectHint: boolean;
  heroVariant: "maternal" | "partner" | "student" | "clinician" | "general";
};

export function buildUserAppContext(input: {
  primaryUseCase: string | null | undefined;
  sex: string | null | undefined;
  profession: string | null | undefined;
}): UserAppContext {
  const primaryUseCase = normalizePrimaryUseCase(input.primaryUseCase);
  return {
    primaryUseCase,
    isPartnerSupport: primaryUseCase === "partner_support",
    isStudentResearch:
      primaryUseCase === "student_research" || input.profession === "student_researcher",
    isClinicianPersona: primaryUseCase === "clinician" || input.profession === "clinician",
  };
}

export function deriveHomeUiVisibility(
  ctx: UserAppContext,
  opts: {
    sex?: string | null | undefined;
    hasActiveCareReadPregnancy: boolean;
    pregnancyStatus: string | null | undefined;
  },
): HomeUiVisibility {
  const st = opts.pregnancyStatus ?? null;
  const stOk = st === "planning" || st === "pregnant" || st === "postpartum";
  const canTrackOwn = userCanTrackOwnPregnancy(opts.sex);

  const showPregnancyJourney =
    canTrackOwn &&
    ((!ctx.isPartnerSupport && stOk) || (ctx.isPartnerSupport && opts.hasActiveCareReadPregnancy));

  const showPartnerConnectHint = ctx.isPartnerSupport && !opts.hasActiveCareReadPregnancy;

  let heroVariant: HomeUiVisibility["heroVariant"] = "general";
  if (ctx.isPartnerSupport) heroVariant = "partner";
  else if (stOk) heroVariant = "maternal";
  else if (ctx.isStudentResearch) heroVariant = "student";
  else if (ctx.isClinicianPersona) heroVariant = "clinician";

  return {
    showPregnancyJourney,
    showVitalsCard: true,
    showSymptomShortcut: true,
    showPlannerShortcut: true,
    showPostpartumShortcut: showPregnancyJourney,
    showStudentFields: ctx.isStudentResearch,
    showClinicianFields: ctx.isClinicianPersona,
    showPartnerConnectHint,
    heroVariant,
  };
}
