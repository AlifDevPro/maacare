import { prepareMultilingualChatTurn, type MultilingualChatPrep, type UiLanguagePrior } from "@/lib/chat/multilingual-prep";
import {
  buildQueryExpansion,
  isMultilingualPipelineEnabled,
  normalizeUserMessage,
  runMultilingualPipeline,
  type DetectorSource,
  type TranslatorSource,
} from "@/lib/ai/multilingual-pipeline";
import { generateTextWithGeminiGroqFailover } from "@/lib/gemini/text-failover";

export type LanguageResolution = MultilingualChatPrep & {
  queryExpansion: string;
  normalizedUserMessage: string;
  retrievalCandidateSize: 5 | 10;
  shouldClarifyBeforeRetrieval: boolean;
  clarificationText: string | null;
  detectorSource?: DetectorSource;
  translatorSource?: TranslatorSource;
};

export function normalizeUiLanguagePrior(value: string | null | undefined): UiLanguagePrior {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v === "bn") return "bn";
  if (v === "en") return "en";
  return null;
}

function estimateTranslationConfidence(input: {
  latestUserMessage: string;
  englishRetrievalQuery: string;
  ietfLanguageTag: string;
  modelConfidence?: number;
}): number {
  if (typeof input.modelConfidence === "number") {
    return Math.max(0, Math.min(1, input.modelConfidence));
  }
  const tag = input.ietfLanguageTag.trim().toLowerCase();
  if (!tag || tag.startsWith("en")) return 0.95;
  const src = input.latestUserMessage.trim();
  const en = input.englishRetrievalQuery.trim();
  if (!src || !en) return 0.62;
  const hasNonAsciiSource = /[^\x00-\x7F]/.test(src);
  const englishWordCount = (en.match(/[a-zA-Z]{2,}/g) ?? []).length;
  if (hasNonAsciiSource && englishWordCount < 2) return 0.66;
  if (hasNonAsciiSource && englishWordCount >= 3) return 0.84;
  return 0.88;
}

async function generateLocalizedClarification(input: {
  ietfLanguageTag: string;
  languageHintForPrompt?: string | null;
  userStyleHint?: "native_script" | "latin_transliteration" | "mixed_code_switch";
}): Promise<string> {
  try {
    const out = await generateTextWithGeminiGroqFailover({
      systemInstruction: [
        "You write one short clarification question for a multilingual assistant.",
        "Return plain text only (no markdown, no quotes, no JSON).",
        "The sentence must ask the user to clarify their intent in one line.",
        "Keep tone warm and natural, max 18 words.",
        "Do not mention translation, confidence, retrieval, or system internals.",
      ].join("\n"),
      userMessage: [
        `Target language tag: ${input.ietfLanguageTag || "en"}`,
        `Language hint: ${input.languageHintForPrompt?.trim() || "user language"}`,
        `Style hint: ${input.userStyleHint ?? "native_script"}`,
        "If style hint is latin_transliteration, keep output in Latin script.",
        "If style hint is mixed_code_switch, match natural mixed style.",
      ].join("\n"),
      temperature: 0.3,
    });
    const text = out.text.trim();
    if (text) return text;
  } catch {
    // Fall through to safe fallback.
  }
  return "To make sure I answer correctly, could you clarify your question a little more?";
}

export function buildLanguagePromptLines(input: {
  ietfLanguageTag: string;
  languageHintForPrompt?: string | null;
  userStyleHint?: "native_script" | "latin_transliteration" | "mixed_code_switch";
}): string[] {
  const tag = input.ietfLanguageTag.trim().toLowerCase() || "en";
  const hint = input.languageHintForPrompt?.trim();
  const styleHint = input.userStyleHint;

  if (tag === "en") {
    return [
      "Reply in natural English.",
      "Avoid robotic phrasing, repetitive templates, and AI-meta language.",
    ];
  }

  return [
    `Reply in the user's language (IETF: ${tag}).`,
    hint
      ? `Language hint: ${hint}. Keep tone native and natural for that language.`
      : "Keep language natural and native, not word-for-word translated from English.",
    styleHint === "latin_transliteration"
      ? "Match user's transliterated typing style in Latin script; do not force native script."
      : styleHint === "mixed_code_switch"
        ? "Match the user's mixed-language style naturally without over-correcting to one language."
        : "If user wrote in native script, prefer native script in the reply.",
    "Use English context only for facts; do not expose translation or retrieval internals.",
    "Use English for internal retrieval/reasoning, but keep the final user-visible answer in the target user language/style.",
  ];
}

export async function resolveLanguageForTurn(input: {
  latestUserMessage: string;
  priorAssistantSnippet?: string | null;
  uiLanguagePrior?: UiLanguagePrior;
}): Promise<LanguageResolution> {
  const normalizedLatestUserMessage = normalizeUserMessage(input.latestUserMessage);

  let corrected: MultilingualChatPrep;
  let detectorSource: DetectorSource | undefined;
  let translatorSource: TranslatorSource | undefined;

  if (isMultilingualPipelineEnabled()) {
    const pipeline = await runMultilingualPipeline({
      latestUserMessage: normalizedLatestUserMessage,
      priorAssistantSnippet: input.priorAssistantSnippet ?? null,
      uiLanguagePrior: input.uiLanguagePrior ?? null,
    });
    corrected = {
      ietfLanguageTag: pipeline.ietfLanguageTag,
      englishRetrievalQuery: pipeline.englishRetrievalQuery,
      languageHintForPrompt: pipeline.languageHintForPrompt,
      translationConfidence: pipeline.translationConfidence,
      userStyleHint: pipeline.userStyleHint,
    };
    detectorSource = pipeline.detectorSource;
    translatorSource = pipeline.translatorSource;
  } else {
    corrected = await prepareMultilingualChatTurn({
      latestUserMessage: normalizedLatestUserMessage,
      priorAssistantSnippet: input.priorAssistantSnippet ?? null,
      uiLanguagePrior: input.uiLanguagePrior ?? null,
    });
  }

  const translationConfidence = estimateTranslationConfidence({
    latestUserMessage: normalizedLatestUserMessage,
    englishRetrievalQuery: corrected.englishRetrievalQuery,
    ietfLanguageTag: corrected.ietfLanguageTag,
    modelConfidence: corrected.translationConfidence,
  });
  const retrievalCandidateSize: 5 | 10 = translationConfidence >= 0.85 ? 5 : 10;
  const shouldClarifyBeforeRetrieval = translationConfidence < 0.7;

  const clarificationText = shouldClarifyBeforeRetrieval
    ? await generateLocalizedClarification({
        ietfLanguageTag: corrected.ietfLanguageTag,
        languageHintForPrompt: corrected.languageHintForPrompt,
        userStyleHint: corrected.userStyleHint,
      })
    : null;

  return {
    ...corrected,
    queryExpansion: buildQueryExpansion(
      normalizedLatestUserMessage,
      corrected.englishRetrievalQuery,
    ),
    normalizedUserMessage: normalizedLatestUserMessage,
    translationConfidence,
    retrievalCandidateSize,
    shouldClarifyBeforeRetrieval,
    clarificationText,
    detectorSource,
    translatorSource,
  };
}
