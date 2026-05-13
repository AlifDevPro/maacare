import { z } from "zod";

import type { ProfessionValue } from "@/lib/profile/profession-values";
import { PROFESSION_VALUES } from "@/lib/profile/profession-values";

/** Non-credential signup state shared by manual wizard and AI-assisted flow. */
export type SignupProfileDraft = {
  displayName: string;
  profession: ProfessionValue | "";
  pregnancyStatus: "planning" | "pregnant" | "postpartum" | "not_applicable";
  lmpDate: string;
  eddDate: string;
  gestationalAgeWeeks: string;
  babyBirthDate: string;
  gravida: string;
  para: string;
  bloodType: string;
  heightCm: string;
  weightKg: string;
  conditionsText: string;
  healthNotes: string;
  phone: string;
  timezone: string;
  notifyCommunityActivity: boolean;
  notifyDailyReminders: boolean;
};

export function emptySignupProfileDraft(): SignupProfileDraft {
  return {
    displayName: "",
    profession: "",
    pregnancyStatus: "pregnant",
    lmpDate: "",
    eddDate: "",
    gestationalAgeWeeks: "",
    babyBirthDate: "",
    gravida: "",
    para: "",
    bloodType: "unknown",
    heightCm: "",
    weightKg: "",
    conditionsText: "",
    healthNotes: "",
    phone: "",
    timezone: "",
    notifyCommunityActivity: true,
    notifyDailyReminders: true,
  };
}

/** AI-assisted signup: do not assume pregnancy; student/researcher paths stay accurate until the user states otherwise. */
export function emptyAiSignupProfileDraft(): SignupProfileDraft {
  return {
    ...emptySignupProfileDraft(),
    pregnancyStatus: "not_applicable",
  };
}

export const signupProfileDraftSchema = z.object({
  displayName: z.string().max(200),
  profession: z.union([z.enum(PROFESSION_VALUES), z.literal("")]),
  pregnancyStatus: z.enum(["planning", "pregnant", "postpartum", "not_applicable"]),
  lmpDate: z.string().max(40),
  eddDate: z.string().max(40),
  gestationalAgeWeeks: z.string().max(10),
  babyBirthDate: z.string().max(40),
  gravida: z.string().max(10),
  para: z.string().max(10),
  bloodType: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"]),
  heightCm: z.string().max(20),
  weightKg: z.string().max(20),
  conditionsText: z.string().max(2000),
  healthNotes: z.string().max(4000),
  phone: z.string().max(80),
  timezone: z.string().max(120),
  notifyCommunityActivity: z.boolean(),
  notifyDailyReminders: z.boolean(),
});
