import { normalizeUiLanguagePrior } from "@/lib/ai/language";

export type SymptomInsightLanguage = "en" | "bn";

/** Output language for symptom AI insights: app UI first, then profile, then English. */
export function resolveSymptomInsightLanguage(
  appLanguage?: string | null,
  profileLanguage?: string | null,
): SymptomInsightLanguage {
  const app = normalizeUiLanguagePrior(appLanguage);
  if (app) return app;
  const profile = normalizeUiLanguagePrior(profileLanguage);
  if (profile) return profile;
  return "en";
}

export function symptomInsightLanguageTag(lang: SymptomInsightLanguage): string {
  return lang === "bn" ? "bn" : "en";
}
