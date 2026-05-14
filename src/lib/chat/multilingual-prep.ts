import { z } from "zod";

import { generateTextWithGeminiGroqFailover } from "@/lib/gemini/text-failover";

/** Loose BCP-47 primary tag + optional subtags (ASCII letters/digits/hyphen). */
const IETF_LANGUAGE_TAG_RE = /^[a-z]{2,8}(-[a-zA-Z0-9]{1,8}){0,3}$/;

const BANGLA_CHAR_RE = /[\u0980-\u09FF]/;

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

const multilingualPrepSchema = z.object({
  ietfLanguageTag: z.string().trim().min(2).max(35).regex(IETF_LANGUAGE_TAG_RE),
  englishRetrievalQuery: z.string().trim().max(4000),
  languageHintForPrompt: z.string().trim().max(200).optional(),
});

export type MultilingualChatPrep = z.infer<typeof multilingualPrepSchema>;

export type UiLanguagePrior = "en" | "bn" | null;

function extractJsonObject(raw: string): string | null {
  const trimmed = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const candidate = fence ? fence[1]!.trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return candidate.slice(start, end + 1);
}

function fallbackPrep(latestUserMessage: string): MultilingualChatPrep {
  const englishRetrievalQuery = latestUserMessage.trim();
  return {
    ietfLanguageTag: "en",
    englishRetrievalQuery,
    languageHintForPrompt: "English",
  };
}

function containsBengaliScript(text: string): boolean {
  return BANGLA_CHAR_RE.test(text);
}

/** Very short replies where profile UI language may disambiguate. */
function isAmbiguousShortReply(text: string): boolean {
  const t = text.trim();
  if (t.length === 0) return true;
  if (t.length > 48) return false;
  const words = t.split(/\s+/).filter(Boolean);
  return words.length <= 6;
}

/**
 * Latin-script English-ish heuristic: no Bangla letters, mostly ASCII letters,
 * and a few common English function words (reduces false `bn` from domain bias).
 */
function looksLikePredominantlyEnglishLatin(text: string): boolean {
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

function primaryTag(tag: string): string {
  return tag.trim().toLowerCase().split("-")[0] ?? "en";
}

/**
 * Post-LLM corrections: script-based checks, false Bangla on English Latin, UI prior for short replies.
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

  if (containsBengaliScript(latest) && primaryTag(tag) !== "bn") {
    return {
      ietfLanguageTag: "bn",
      englishRetrievalQuery: q,
      languageHintForPrompt: hint ?? "Bengali (Bangla)",
    };
  }

  if (primaryTag(tag) === "bn" && !containsBengaliScript(latest) && looksLikePredominantlyEnglishLatin(latest)) {
    return {
      ietfLanguageTag: "en",
      englishRetrievalQuery: q,
      languageHintForPrompt: "English",
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
    };
  }

  if (isAmbiguousShortReply(latest) && uiLanguagePrior === "bn" && containsBengaliScript(latest)) {
    return {
      ietfLanguageTag: "bn",
      englishRetrievalQuery: q,
      languageHintForPrompt: hint ?? "Bengali (Bangla)",
    };
  }

  const out: MultilingualChatPrep = { ietfLanguageTag: tag, englishRetrievalQuery: q };
  if (hint) out.languageHintForPrompt = hint;
  return out;
}

/**
 * One LLM call: infer reply language (BCP-47) and produce an English string suitable for embedding / RAG.
 * On parse or validation failure, falls back to English + raw message (safe for retrieval).
 */
export async function prepareMultilingualChatTurn(input: {
  latestUserMessage: string;
  /** Short prior assistant line helps disambiguate terse replies (e.g. "ok", "thanks"). */
  priorAssistantSnippet?: string | null;
  /** Profile UI language (`profiles.language`): tie-breaker for ambiguous short replies only. */
  uiLanguagePrior?: UiLanguagePrior;
}): Promise<MultilingualChatPrep> {
  const trimmed = input.latestUserMessage.trim();
  if (!trimmed) {
    return { ietfLanguageTag: "en", englishRetrievalQuery: "", languageHintForPrompt: "English" };
  }

  const prior =
    input.priorAssistantSnippet?.trim().slice(0, 600) ??
    null;

  const priorBlock = prior
    ? [
        "",
        "IMMEDIATELY_PRIOR_ASSISTANT_MESSAGE (for context only; infer reply language from LATEST_USER_MESSAGE, not from this block alone):",
        prior,
      ].join("\n")
    : "";

  const uiPriorLine =
    input.uiLanguagePrior === "en" || input.uiLanguagePrior === "bn"
      ? `\nUI_LANGUAGE_PRIOR (tie-break only for very short or ambiguous latest messages; values: en | bn): ${input.uiLanguagePrior}`
      : "";

  const userBlock = ["LATEST_USER_MESSAGE:", trimmed, priorBlock, uiPriorLine].join("\n");

  const baseRules = [
    "You prepare metadata for a multilingual health assistant (maternal / wellness).",
    "Return a single JSON object only (no markdown, no prose) with exactly these keys:",
    '  "ietfLanguageTag": BCP-47 tag for the language the user is writing in on the LATEST user message (e.g. "en", "bn", "es", "ar", "hi-Latn").',
    '  "englishRetrievalQuery": one concise English line suitable for semantic search over an English-only medical corpus. Preserve drug names, conditions, and numbers. If the latest message is already good for English embedding, you may repeat it cleaned up.',
    '  "languageHintForPrompt": optional short English label for the answer model (e.g. "Bengali (Bangla)", "Spanish").',
    "Rules:",
    "- The LATEST user message is the source of truth for ietfLanguageTag. Use the prior assistant message only when the latest message is very short or ambiguous (e.g. ok, thanks, yes).",
    '- If the latest message is ordinary Latin-script English (clear English words and grammar), ietfLanguageTag MUST be "en". Do NOT set "bn" because the app is Bangladesh-focused, because the prior assistant was Bangla, or because the topic is pregnancy.',
    "- If the latest message contains Bengali script (Unicode Bengali range U+0980–U+09FF), prefer ietfLanguageTag \"bn\" unless the same turn is clearly another language.",
    '- If UI_LANGUAGE_PRIOR is present and the latest message is ambiguous, use it only as a tie-breaker (e.g. "thanks" + prior en -> "en").',
    "- Do not answer the medical question. Do not add keys beyond the three above.",
  ].join("\n");

  try {
    const out = await generateTextWithGeminiGroqFailover({
      systemInstruction: baseRules,
      userMessage: userBlock,
      temperature: 0.2,
    });

    const jsonStr = extractJsonObject(out.text);
    if (!jsonStr) {
      return applyReplyLanguageOverrides(fallbackPrep(trimmed), trimmed, input.uiLanguagePrior ?? null);
    }

    const parsed = JSON.parse(jsonStr) as unknown;
    const data = multilingualPrepSchema.safeParse(parsed);
    if (!data.success) {
      return applyReplyLanguageOverrides(fallbackPrep(trimmed), trimmed, input.uiLanguagePrior ?? null);
    }

    const q = data.data.englishRetrievalQuery.trim() || trimmed;
    const tag = data.data.ietfLanguageTag.trim().toLowerCase() || "en";
    const hint = data.data.languageHintForPrompt?.trim();

    const rawPrep: MultilingualChatPrep = {
      ietfLanguageTag: tag,
      englishRetrievalQuery: q,
      ...(hint ? { languageHintForPrompt: hint } : {}),
    };
    return applyReplyLanguageOverrides(rawPrep, trimmed, input.uiLanguagePrior ?? null);
  } catch {
    return applyReplyLanguageOverrides(fallbackPrep(trimmed), trimmed, input.uiLanguagePrior ?? null);
  }
}
