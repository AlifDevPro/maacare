import { z } from "zod";

import type { ProfessionValue } from "@/lib/profile/profession-values";
import { PROFESSION_VALUES } from "@/lib/profile/profession-values";

import { PRIMARY_USE_CASE_VALUES } from "@/lib/profile/primary-use-case";

import type { SignupProfileDraft } from "./signup-draft";

const primaryUseCaseEnum = z.enum(
  PRIMARY_USE_CASE_VALUES as unknown as [string, ...string[]],
);

const pregnancyEnum = z.enum(["planning", "pregnant", "postpartum", "not_applicable"]);

/** Allowlisted keys only — never email or password. */
export const signupAiDraftPatchSchema = z
  .object({
    displayName: z.string().max(200).optional(),
    sex: z.enum(["female", "male", "other", "unknown"]).optional(),
    primaryUseCase: primaryUseCaseEnum.optional(),
    profession: z
      .union([z.enum(PROFESSION_VALUES as unknown as [string, ...string[]]), z.literal("other")])
      .optional()
      .transform((v): ProfessionValue | undefined => {
        if (v === undefined) return undefined;
        return v === "other" ? "student_researcher" : (v as ProfessionValue);
      }),
    pregnancyStatus: pregnancyEnum.optional(),
    lmpDate: z.string().max(40).optional(),
    eddDate: z.string().max(40).optional(),
    gestationalAgeWeeks: z.union([z.string().max(10), z.number()]).optional(),
    babyBirthDate: z.string().max(40).optional(),
    gravida: z.union([z.string().max(10), z.number().int().min(0).max(30)]).optional(),
    para: z.union([z.string().max(10), z.number().int().min(0).max(30)]).optional(),
    bloodType: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"]).optional(),
    heightCm: z.union([z.string().max(20), z.number()]).optional(),
    weightKg: z.union([z.string().max(20), z.number()]).optional(),
    conditionsText: z.string().max(2000).optional(),
    healthNotes: z.string().max(4000).optional(),
    phone: z.string().max(80).optional(),
    timezone: z.string().max(120).optional(),
    notifyCommunityActivity: z.boolean().optional(),
    notifyDailyReminders: z.boolean().optional(),
  })
  .strict();

export type SignupAiDraftPatch = z.infer<typeof signupAiDraftPatchSchema>;

export function parseDraftPatchLine(fullModelText: string): {
  assistantVisible: string;
  patch: SignupAiDraftPatch | null;
} {
  const marker = "DRAFT_PATCH:";
  const idx = fullModelText.lastIndexOf(marker);
  if (idx === -1) {
    return { assistantVisible: fullModelText.trim(), patch: null };
  }
  const assistantVisible = fullModelText.slice(0, idx).trim();
  const jsonPart = fullModelText.slice(idx + marker.length).trim();
  let toParse = jsonPart;
  if (toParse.startsWith("```")) {
    toParse = toParse
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
  }
  try {
    const raw = JSON.parse(toParse) as unknown;
    const parsed = signupAiDraftPatchSchema.safeParse(raw);
    if (!parsed.success) return { assistantVisible, patch: null };
    return { assistantVisible, patch: parsed.data };
  } catch {
    return { assistantVisible, patch: null };
  }
}

function numToStr(v: string | number | undefined): string {
  if (v === undefined) return "";
  return typeof v === "number" ? String(v) : v;
}

export function mergeSignupProfileDraft(base: SignupProfileDraft, patch: SignupAiDraftPatch): SignupProfileDraft {
  const next = { ...base };
  if (patch.displayName !== undefined) next.displayName = patch.displayName;
  if (patch.sex !== undefined) next.sex = patch.sex;
  if (patch.primaryUseCase !== undefined) {
    next.primaryUseCase = patch.primaryUseCase as SignupProfileDraft["primaryUseCase"];
  }
  if (patch.profession !== undefined) next.profession = patch.profession;
  if (patch.pregnancyStatus !== undefined) next.pregnancyStatus = patch.pregnancyStatus;
  if (patch.lmpDate !== undefined) next.lmpDate = patch.lmpDate;
  if (patch.eddDate !== undefined) next.eddDate = patch.eddDate;
  if (patch.gestationalAgeWeeks !== undefined) next.gestationalAgeWeeks = numToStr(patch.gestationalAgeWeeks);
  if (patch.babyBirthDate !== undefined) next.babyBirthDate = patch.babyBirthDate;
  if (patch.gravida !== undefined) next.gravida = numToStr(patch.gravida);
  if (patch.para !== undefined) next.para = numToStr(patch.para);
  if (patch.bloodType !== undefined) next.bloodType = patch.bloodType;
  if (patch.heightCm !== undefined) next.heightCm = numToStr(patch.heightCm);
  if (patch.weightKg !== undefined) next.weightKg = numToStr(patch.weightKg);
  if (patch.conditionsText !== undefined) next.conditionsText = patch.conditionsText;
  if (patch.healthNotes !== undefined) next.healthNotes = patch.healthNotes;
  if (patch.phone !== undefined) next.phone = patch.phone;
  if (patch.timezone !== undefined) next.timezone = patch.timezone;
  if (patch.notifyCommunityActivity !== undefined) next.notifyCommunityActivity = patch.notifyCommunityActivity;
  if (patch.notifyDailyReminders !== undefined) next.notifyDailyReminders = patch.notifyDailyReminders;
  return next;
}
