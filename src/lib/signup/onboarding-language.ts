import { buildLanguagePromptLines } from "@/lib/ai/language";
import { detectExplicitLanguageSwitchRequest } from "@/lib/ai/multilingual-pipeline/conversation-language";
import {
  languageHintForTag,
  normalizeIetfTag,
  primaryTag,
} from "@/lib/ai/multilingual-pipeline/language-heuristics";
import type { UserStyleHint } from "@/lib/ai/multilingual-pipeline/types";

export type OnboardingLanguageSource =
  | "user_selected"
  | "onboarding_lock"
  | "app"
  | "browser"
  | "default"
  | "explicit_switch";

export type ResolveOnboardingLanguageInput = {
  latestUserMessage?: string;
  onboardingLanguage?: string | null;
  userSelectedLanguage?: string | null;
  appLanguage?: string | null;
  browserLanguage?: string | null;
};

export type OnboardingLanguageResolution = {
  ietfLanguageTag: string;
  languageHintForPrompt: string;
  onboardingLanguage: string;
  source: OnboardingLanguageSource;
  userStyleHint: UserStyleHint;
  languagePromptLines: string[];
};

const DEFAULT_ONBOARDING_LANGUAGE = "en";

function normalizePreference(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const tag = normalizeIetfTag(raw.trim());
  const primary = primaryTag(tag);
  if (primary === "bn" || primary === "en") return primary;
  return primary;
}

/**
 * Registration onboarding language — never infers language from names or short replies.
 */
export function resolveOnboardingLanguage(
  input: ResolveOnboardingLanguageInput,
): OnboardingLanguageResolution {
  const latest = input.latestUserMessage?.trim() ?? "";
  const explicitSwitch = latest ? detectExplicitLanguageSwitchRequest(latest) : null;

  if (explicitSwitch) {
    return finalize(explicitSwitch, "explicit_switch");
  }

  const locked = normalizePreference(input.onboardingLanguage);
  if (locked) {
    return finalize(locked, "onboarding_lock");
  }

  const userSelected = normalizePreference(input.userSelectedLanguage);
  if (userSelected) {
    return finalize(userSelected, "user_selected");
  }

  const appLang = normalizePreference(input.appLanguage);
  if (appLang) {
    return finalize(appLang, "app");
  }

  const browserLang = normalizePreference(input.browserLanguage);
  if (browserLang) {
    return finalize(browserLang, "browser");
  }

  return finalize(DEFAULT_ONBOARDING_LANGUAGE, "default");
}

function finalize(tag: string, source: OnboardingLanguageSource): OnboardingLanguageResolution {
  const ietfLanguageTag = normalizeIetfTag(tag);
  const languageHintForPrompt = languageHintForTag(ietfLanguageTag);
  return {
    ietfLanguageTag,
    languageHintForPrompt,
    onboardingLanguage: ietfLanguageTag,
    source,
    userStyleHint: primaryTag(ietfLanguageTag) === "bn" ? "native_script" : "native_script",
    languagePromptLines: [
      ...buildLanguagePromptLines({
        ietfLanguageTag,
        languageHintForPrompt,
        userStyleHint: "native_script",
      }),
      "ONBOARDING LANGUAGE LOCK: Keep the same language for the entire registration chat.",
      "Never switch language because of a name, single word, or short answer.",
      "Only switch if the user explicitly asks to reply in another language.",
      "Stay concise and task-focused — this is account setup, not open conversation.",
    ],
  };
}

export function normalizeOnboardingLanguageTag(raw: string | null | undefined): string {
  return normalizePreference(raw) ?? DEFAULT_ONBOARDING_LANGUAGE;
}
