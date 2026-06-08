import {
  containsBengaliScript,
  languageHintForTag,
  looksLikePredominantlyEnglishLatin,
  normalizeIetfTag,
  primaryTag,
} from "./language-heuristics";
import type { UiLanguagePrior } from "./types";

/** Max words before a message is treated as linguistically informative. */
export const SHORT_MESSAGE_MAX_WORDS = 5;

/** Below this detection confidence, keep the active conversation language. */
export const LANGUAGE_CONFIDENCE_THRESHOLD = 0.75;

/** Minimum confidence to switch on a single substantial user message. */
export const SINGLE_MESSAGE_SWITCH_CONFIDENCE = 0.85;

const DEVANAGARI_CHAR_RE = /[\u0900-\u097F]/;

const UNIVERSAL_SHORT_TOKENS = new Set([
  "yes",
  "no",
  "ok",
  "okay",
  "sure",
  "thanks",
  "thank",
  "continue",
  "yep",
  "nope",
  "yeah",
  "nah",
  "hi",
  "hello",
  "please",
  "help",
]);

const TIME_OR_SCHEDULE_RE =
  /^(?:\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?|tomorrow|today|tonight|next\s+week|this\s+week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i;

const EXPLICIT_SWITCH_PATTERNS: Array<{ re: RegExp; tag: string }> = [
  { re: /(?:answer|reply|respond|speak|talk|write)\s+(?:in|using)\s+bengali/i, tag: "bn" },
  { re: /(?:answer|reply|respond|speak|talk|write)\s+(?:in|using)\s+bangla/i, tag: "bn" },
  { re: /(?:answer|reply|respond|speak|talk|write)\s+(?:in|using)\s+english/i, tag: "en" },
  { re: /(?:answer|reply|respond|speak|talk|write)\s+(?:in|using)\s+spanish/i, tag: "es" },
  { re: /(?:answer|reply|respond|speak|talk|write)\s+(?:in|using)\s+hindi/i, tag: "hi" },
  { re: /(?:answer|reply|respond|speak|talk|write)\s+(?:in|using)\s+arabic/i, tag: "ar" },
  { re: /(?:answer|reply|respond|speak|talk|write)\s+(?:in|using)\s+french/i, tag: "fr" },
  { re: /(?:answer|reply|respond|speak|talk|write)\s+(?:in|using)\s+filipino/i, tag: "fil" },
  { re: /(?:answer|reply|respond|speak|talk|write)\s+(?:in|using)\s+tagalog/i, tag: "tl" },
  { re: /বাংলায়\s+(?:উত্তর|বল|লিখ)/u, tag: "bn" },
  { re: /ইংরেজিতে\s+(?:উত্তর|বল|লিখ)/u, tag: "en" },
  { re: /(?:in|using)\s+bengali\b/i, tag: "bn" },
  { re: /(?:in|using)\s+bangla\b/i, tag: "bn" },
];

export type ConversationLanguageSource =
  | "explicit_preference"
  | "explicit_switch"
  | "conversation_lock"
  | "profile"
  | "app"
  | "detection"
  | "multi_message_switch";

export type ResolveConversationLanguageInput = {
  latestUserMessage: string;
  conversationLanguage?: string | null;
  recentUserMessages?: string[];
  priorAssistantSnippet?: string | null;
  uiLanguagePrior?: UiLanguagePrior;
  appLanguage?: string | null;
  explicitUserLanguagePreference?: string | null;
  detectedTag?: string;
  detectionConfidence?: number;
};

export type ResolveConversationLanguageResult = {
  ietfLanguageTag: string;
  languageHintForPrompt: string;
  source: ConversationLanguageSource;
  skipDetection: boolean;
  updatedConversationLanguage: string;
};

function normalizeAppLanguage(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const tag = normalizeIetfTag(raw.trim());
  return tag === "en" || tag === "bn" ? tag : primaryTag(tag);
}

export function isShortLowInfoMessage(text: string, maxWords = SHORT_MESSAGE_MAX_WORDS): boolean {
  const t = text.trim();
  if (!t) return true;
  if (t.length > 48) return false;

  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > maxWords) return false;

  const lower = t.toLowerCase().replace(/[^\p{L}\p{N}\s:./-]/gu, "").trim();
  if (TIME_OR_SCHEDULE_RE.test(lower)) return true;

  if (words.length === 1 && UNIVERSAL_SHORT_TOKENS.has(words[0]!.toLowerCase())) return true;
  if (words.every((w) => UNIVERSAL_SHORT_TOKENS.has(w.toLowerCase()))) return true;

  return words.length <= maxWords;
}

export function detectExplicitLanguageSwitchRequest(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  for (const { re, tag } of EXPLICIT_SWITCH_PATTERNS) {
    if (re.test(trimmed)) return tag;
  }
  return null;
}

function inferLanguageFromScript(text: string): string | null {
  if (containsBengaliScript(text)) return "bn";
  if (DEVANAGARI_CHAR_RE.test(text)) return "hi";
  return null;
}

function inferLanguageFromHeuristics(text: string): string | null {
  const script = inferLanguageFromScript(text);
  if (script) return script;
  if (looksLikePredominantlyEnglishLatin(text)) return "en";
  return null;
}

/** Infer locked language from prior substantial user turns in the current request. */
export function inferConversationLanguageFromHistory(userMessages: string[]): string | null {
  for (let i = userMessages.length - 1; i >= 0; i -= 1) {
    const msg = userMessages[i]?.trim() ?? "";
    if (!msg || isShortLowInfoMessage(msg)) continue;
    const inferred = inferLanguageFromHeuristics(msg);
    if (inferred) return inferred;
  }
  return null;
}

function countSubstantialMessagesInLanguage(
  messages: string[],
  languageTag: string,
): number {
  const want = primaryTag(languageTag);
  let count = 0;
  for (const msg of messages) {
    const trimmed = msg.trim();
    if (!trimmed || isShortLowInfoMessage(trimmed)) continue;
    const inferred = inferLanguageFromHeuristics(trimmed);
    if (inferred && primaryTag(inferred) === want) count += 1;
  }
  return count;
}

function shouldSwitchFromConsistentMessages(input: {
  conversationLanguage: string;
  latestUserMessage: string;
  recentUserMessages: string[];
  detectedTag: string;
  detectionConfidence: number;
}): boolean {
  const current = primaryTag(input.conversationLanguage);
  const detected = primaryTag(input.detectedTag);
  if (current === detected) return false;
  if (isShortLowInfoMessage(input.latestUserMessage)) return false;
  if (input.detectionConfidence < LANGUAGE_CONFIDENCE_THRESHOLD) return false;

  const priorSubstantial = input.recentUserMessages.filter(
    (m) => m.trim() && !isShortLowInfoMessage(m),
  );
  const allSubstantial = [...priorSubstantial, input.latestUserMessage.trim()];

  if (allSubstantial.length === 1) {
    return input.detectionConfidence >= SINGLE_MESSAGE_SWITCH_CONFIDENCE;
  }

  return countSubstantialMessagesInLanguage(allSubstantial.slice(-2), detected) >= 2;
}

function activeConversationLanguage(input: ResolveConversationLanguageInput): string | null {
  return (
    input.conversationLanguage?.trim() ||
    inferConversationLanguageFromHistory(input.recentUserMessages ?? []) ||
    null
  );
}

function toResult(
  tag: string,
  source: ConversationLanguageSource,
  skipDetection: boolean,
): ResolveConversationLanguageResult {
  const normalized = normalizeIetfTag(tag);
  return {
    ietfLanguageTag: normalized,
    languageHintForPrompt: languageHintForTag(normalized),
    source,
    skipDetection,
    updatedConversationLanguage: normalized,
  };
}

/**
 * Resolve language without running CLD3 when conversation rules allow it.
 * Returns null when auto-detection on the latest message is required.
 */
export function tryResolveWithoutDetection(
  input: ResolveConversationLanguageInput,
): ResolveConversationLanguageResult | null {
  const latest = input.latestUserMessage.trim();
  if (!latest) return toResult("en", "detection", true);

  const explicitSwitch = detectExplicitLanguageSwitchRequest(latest);
  if (explicitSwitch) return toResult(explicitSwitch, "explicit_switch", true);

  const explicitPref = normalizeAppLanguage(input.explicitUserLanguagePreference);
  if (explicitPref) {
    return toResult(explicitPref, "explicit_preference", isShortLowInfoMessage(latest));
  }

  const locked = activeConversationLanguage(input);
  const scriptLang = inferLanguageFromScript(latest);

  if (scriptLang && !isShortLowInfoMessage(latest)) {
    return toResult(scriptLang, "detection", true);
  }

  if (locked && isShortLowInfoMessage(latest)) {
    return toResult(locked, "conversation_lock", true);
  }

  if (locked && scriptLang) {
    return toResult(scriptLang, "detection", true);
  }

  return null;
}

/**
 * Finalize reply language after optional CLD3 detection using conversation-level rules.
 */
export function finalizeConversationLanguage(
  input: ResolveConversationLanguageInput,
): ResolveConversationLanguageResult {
  const latest = input.latestUserMessage.trim();
  const withoutDetection = tryResolveWithoutDetection(input);
  if (withoutDetection) return withoutDetection;

  const explicitPref = normalizeAppLanguage(input.explicitUserLanguagePreference);
  const appLang = normalizeAppLanguage(input.appLanguage);
  const profileLang = input.uiLanguagePrior ?? null;
  const locked = activeConversationLanguage(input);

  const detectedTag = input.detectedTag ? normalizeIetfTag(input.detectedTag) : null;
  const confidence = input.detectionConfidence ?? 0;

  if (
    locked &&
    detectedTag &&
    shouldSwitchFromConsistentMessages({
      conversationLanguage: locked,
      latestUserMessage: latest,
      recentUserMessages: input.recentUserMessages ?? [],
      detectedTag,
      detectionConfidence: confidence,
    })
  ) {
    return toResult(detectedTag, "multi_message_switch", false);
  }

  if (locked && detectedTag && confidence < LANGUAGE_CONFIDENCE_THRESHOLD) {
    return toResult(locked, "conversation_lock", true);
  }

  if (locked && detectedTag && primaryTag(detectedTag) !== primaryTag(locked)) {
    return toResult(locked, "conversation_lock", true);
  }

  if (detectedTag && confidence >= LANGUAGE_CONFIDENCE_THRESHOLD) {
    return toResult(detectedTag, "detection", false);
  }

  if (locked) return toResult(locked, "conversation_lock", true);
  if (explicitPref) return toResult(explicitPref, "explicit_preference", false);
  if (profileLang) return toResult(profileLang, "profile", false);
  if (appLang) return toResult(appLang, "app", false);

  return toResult(detectedTag ?? "en", "detection", false);
}
