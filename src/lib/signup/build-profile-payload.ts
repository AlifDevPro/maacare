import { resolveProfileFieldVisibility } from "@/lib/profile/journey-fields";
import { normalizePrimaryUseCase } from "@/lib/profile/primary-use-case";

import type { SignupProfileDraft } from "./signup-draft";

/** Same shape as manual signup `profilePayload` before JSON.stringify to PATCH /api/profile. */
export function buildSignupProfilePayload(d: SignupProfileDraft): Record<string, unknown> {
  const profilePayload: Record<string, unknown> = {
    displayName: d.displayName.trim(),
    phone: d.phone.trim() || undefined,
    timezone: d.timezone.trim() || undefined,
    profession: d.profession || undefined,
    primaryUseCase: normalizePrimaryUseCase(d.primaryUseCase as string | null | undefined),
    pregnancyStatus: d.pregnancyStatus,
    notifyCommunityActivity: d.notifyCommunityActivity,
    notifyDailyReminders: d.notifyDailyReminders,
  };

  if (d.sex) profilePayload.sex = d.sex;

  const vis = resolveProfileFieldVisibility(d.pregnancyStatus, d.primaryUseCase);
  if (vis.showLmpEdd) {
    profilePayload.lmpDate = d.lmpDate || undefined;
    profilePayload.eddDate = d.eddDate || undefined;
  } else {
    profilePayload.lmpDate = null;
    profilePayload.eddDate = null;
  }
  if (vis.showGestationalWeek) {
    profilePayload.gestationalAgeWeeks =
      d.gestationalAgeWeeks !== "" && !Number.isNaN(Number.parseInt(d.gestationalAgeWeeks, 10))
        ? Number.parseInt(d.gestationalAgeWeeks, 10)
        : null;
  } else {
    profilePayload.gestationalAgeWeeks = null;
  }
  if (vis.showBabyBirth) {
    profilePayload.babyBirthDate = d.babyBirthDate.trim() || null;
  } else {
    profilePayload.babyBirthDate = null;
  }
  if (vis.showGravidaPara) {
    profilePayload.gravida =
      d.gravida !== "" && !Number.isNaN(Number.parseInt(d.gravida, 10))
        ? Number.parseInt(d.gravida, 10)
        : null;
    profilePayload.para =
      d.para !== "" && !Number.isNaN(Number.parseInt(d.para, 10)) ? Number.parseInt(d.para, 10) : null;
  } else {
    profilePayload.gravida = null;
    profilePayload.para = null;
  }

  profilePayload.bloodType = d.bloodType;
  if (d.heightCm) profilePayload.heightCm = Number(d.heightCm);
  if (d.weightKg) profilePayload.weightKg = Number(d.weightKg);
  if (d.healthNotes.trim()) profilePayload.healthNotes = d.healthNotes.trim();
  const conditions = d.conditionsText
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (conditions.length > 0) profilePayload.conditions = conditions;

  return profilePayload;
}
