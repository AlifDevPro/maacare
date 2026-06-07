import type { UserStyleHint, UiLanguagePrior } from "./types";

/** Loose BCP-47 primary tag + optional subtags (ASCII letters/digits/hyphen). */
export const IETF_LANGUAGE_TAG_RE = /^[a-z]{2,8}(-[a-zA-Z0-9]{1,8}){0,3}$/;

const BANGLA_CHAR_RE = /[\u0980-\u09FF]/;
const DEVANAGARI_CHAR_RE = /[\u0900-\u097F]/;
const LATIN_CHAR_RE = /[A-Za-z]/;

/** Common English tokens — used only to reduce false `bn` tags on Latin-script English. */
const ENGLISH_HINT_WORDS = new Set([
  "the",
  "a",
  "an",
  "is",
  "are",
  "was",
  "were",
  "what",
  "when",
  "where",
  "how",
  "why",
  "who",
  "which",
  "can",
  "could",
  "would",
  "should",
  "my",
  "i",
  "me",
  "we",
  "you",
  "your",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "not",
  "with",
  "for",
  "from",
  "this",
  "that",
  "please",
  "thanks",
  "thank",
  "hello",
  "hi",
  "ok",
  "okay",
  "yes",
  "no",
  "help",
  "pain",
  "feel",
  "feeling",
  "week",
  "pregnant",
  "pregnancy",
  "baby",
  "blood",
  "doctor",
  "hospital",
  "near",
  "nearest",
]);

const LANGUAGE_HINTS: Record<string, string> = {
  en: "English",
  bn: "Bengali (Bangla)",
  hi: "Hindi",
  es: "Spanish",
  ar: "Arabic",
  ur: "Urdu",
  fr: "French",
  pt: "Portuguese",
};

export type MultilingualChatPrep = {
  ietfLanguageTag: string;
  englishRetrievalQuery: string;
  languageHintForPrompt?: string;
  translationConfidence?: number;
  userStyleHint?: UserStyleHint;
};

export function containsBengaliScript(text: string): boolean {
  return BANGLA_CHAR_RE.test(text);
}

export function inferUserStyleHint(input: {
  latestUserMessage: string;
  ietfLanguageTag: string;
}): UserStyleHint {
  const text = input.latestUserMessage;
  const hasLatin = LATIN_CHAR_RE.test(text);
  const hasBangla = BANGLA_CHAR_RE.test(text);
  const hasDevanagari = DEVANAGARI_CHAR_RE.test(text);
  const hasIndic = hasBangla || hasDevanagari;
  if (hasLatin && hasIndic) return "mixed_code_switch";
  const tag = input.ietfLanguageTag.trim().toLowerCase();
  if ((tag.startsWith("bn") || tag.startsWith("hi")) && hasLatin && !hasIndic) {
    return "latin_transliteration";
  }
  return "native_script";
}

export function isAmbiguousShortReply(text: string): boolean {
  const t = text.trim();
  if (t.length === 0) return true;
  if (t.length > 48) return false;
  const words = t.split(/\s+/).filter(Boolean);
  return words.length <= 6;
}

export function looksLikePredominantlyEnglishLatin(text: string): boolean {
  if (!text.trim()) return false;
  if (containsBengaliScript(text)) return false;

  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length === 0) return false;

  let latinCount = 0;
  let nonLatinLetterCount = 0;
  for (const ch of letters) {
    const cp = ch.codePointAt(0)!;
    if ((cp >= 65 && cp <= 90) || (cp >= 97 && cp <= 122)) latinCount += 1;
    else nonLatinLetterCount += 1;
  }
  const letterTotal = latinCount + nonLatinLetterCount;
  if (letterTotal === 0) return false;
  if (latinCount / letterTotal < 0.82) return false;

  const tokens = text.toLowerCase().match(/[a-z]+/g) ?? [];
  let hintHits = 0;
  for (const w of tokens) {
    if (ENGLISH_HINT_WORDS.has(w)) hintHits += 1;
  }
  if (text.length >= 24 && hintHits >= 2) return true;
  if (text.length >= 8 && hintHits >= 1 && tokens.length <= 8) return true;
  if (text.length >= 64 && hintHits >= 1) return true;
  return false;
}

export function primaryTag(tag: string): string {
  return tag.trim().toLowerCase().split("-")[0] ?? "en";
}

export function languageHintForTag(tag: string): string {
  const p = primaryTag(tag);
  return LANGUAGE_HINTS[p] ?? p.toUpperCase();
}

export function normalizeIetfTag(raw: string): string {
  const t = raw.trim().toLowerCase().replace(/_/g, "-");
  if (!t || t === "und" || t === "unknown") return "en";
  if (IETF_LANGUAGE_TAG_RE.test(t)) return t;
  const primary = t.split("-")[0] ?? "en";
  if (IETF_LANGUAGE_TAG_RE.test(primary)) return primary;
  return "en";
}

/**
 * Post-detection corrections: script-based checks, false Bangla on English Latin, UI prior for short replies.
 */
export function applyReplyLanguageOverrides(
  prep: MultilingualChatPrep,
  latestUserMessage: string,
  uiLanguagePrior: UiLanguagePrior,
): MultilingualChatPrep {
  const latest = latestUserMessage.trim();
  if (!latest) return prep;

  const tag = prep.ietfLanguageTag.trim().toLowerCase() || "en";
  const hint = prep.languageHintForPrompt?.trim();
  const q = prep.englishRetrievalQuery.trim() || latest;
  const styleHint =
    prep.userStyleHint ??
    inferUserStyleHint({
      latestUserMessage: latest,
      ietfLanguageTag: prep.ietfLanguageTag,
    });

  if (containsBengaliScript(latest) && primaryTag(tag) !== "bn") {
    return {
      ietfLanguageTag: "bn",
      englishRetrievalQuery: q,
      languageHintForPrompt: hint ?? "Bengali (Bangla)",
      translationConfidence: prep.translationConfidence,
      userStyleHint: styleHint,
    };
  }

  if (primaryTag(tag) === "bn" && !containsBengaliScript(latest) && looksLikePredominantlyEnglishLatin(latest)) {
    return {
      ietfLanguageTag: "en",
      englishRetrievalQuery: q,
      languageHintForPrompt: "English",
      translationConfidence: prep.translationConfidence,
      userStyleHint: styleHint,
    };
  }

  if (
    isAmbiguousShortReply(latest) &&
    uiLanguagePrior === "en" &&
    !containsBengaliScript(latest) &&
    primaryTag(tag) === "bn"
  ) {
    return {
      ietfLanguageTag: "en",
      englishRetrievalQuery: q,
      languageHintForPrompt: "English",
      translationConfidence: prep.translationConfidence,
      userStyleHint: styleHint,
    };
  }

  if (isAmbiguousShortReply(latest) && uiLanguagePrior === "bn" && containsBengaliScript(latest)) {
    return {
      ietfLanguageTag: "bn",
      englishRetrievalQuery: q,
      languageHintForPrompt: hint ?? "Bengali (Bangla)",
      translationConfidence: prep.translationConfidence,
      userStyleHint: styleHint,
    };
  }

  const out: MultilingualChatPrep = {
    ietfLanguageTag: tag,
    englishRetrievalQuery: q,
    userStyleHint: styleHint,
  };
  if (hint) out.languageHintForPrompt = hint;
  if (typeof prep.translationConfidence === "number") out.translationConfidence = prep.translationConfidence;
  return out;
}

export function inferLanguageFromPriorSnippet(priorSnippet: string | null | undefined): string | null {
  const prior = priorSnippet?.trim() ?? "";
  if (!prior) return null;
  if (containsBengaliScript(prior)) return "bn";
  if (DEVANAGARI_CHAR_RE.test(prior)) return "hi";
  if (looksLikePredominantlyEnglishLatin(prior)) return "en";
  return null;
}
