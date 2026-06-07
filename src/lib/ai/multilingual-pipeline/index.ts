import { detectLanguage } from "./language-detector";
import { translateToEnglishQuery } from "./query-translator";
import { isMultilingualPipelineEnabled } from "./config";
import { applyReplyLanguageOverrides, languageHintForTag } from "./language-heuristics";
import type { MultilingualPipelineResult, UiLanguagePrior } from "./types";

export { isMultilingualPipelineEnabled } from "./config";
export { postProcessMultilingualReply } from "./response-post-processor";
export { detectLanguage, detectReplyLanguage } from "./language-detector";
export { translateToEnglishQuery } from "./query-translator";
export {
  applyReplyLanguageOverrides,
  containsBengaliScript,
  languageHintForTag,
} from "./language-heuristics";
export type {
  MultilingualPipelineResult,
  UiLanguagePrior,
  UserStyleHint,
  DetectorSource,
  TranslatorSource,
} from "./types";

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "what",
  "where",
  "when",
  "please",
]);

const PUNCT_EQUIVALENTS: Array<[RegExp, string]> = [
  [/[\uFF0C\u3001]/g, ","],
  [/[\uFF1A]/g, ":"],
  [/[\uFF1B]/g, ";"],
  [/[\uFF01]/g, "!"],
  [/[\uFF1F]/g, "?"],
  [/[\u3002]/g, "."],
  [/[\u2018\u2019]/g, "'"],
  [/[\u201C\u201D]/g, '"'],
];

export function normalizeUserMessage(text: string): string {
  let out = text.normalize("NFC");
  for (const [re, to] of PUNCT_EQUIVALENTS) out = out.replace(re, to);
  return out;
}

function extractKeywordHints(text: string): string[] {
  const words = (text.toLowerCase().match(/[a-z][a-z0-9_-]{2,}/g) ?? []).filter(
    (w) => !STOPWORDS.has(w),
  );
  return Array.from(new Set(words)).slice(0, 8);
}

export function buildQueryExpansion(latestUserMessage: string, englishRetrievalQuery: string): string {
  const query = englishRetrievalQuery.trim();
  if (!query) return latestUserMessage.trim();
  const hints = extractKeywordHints(latestUserMessage);
  if (hints.length === 0) return query;
  return `${query} | key terms: ${hints.join(", ")}`;
}

export async function runMultilingualPipeline(input: {
  latestUserMessage: string;
  priorAssistantSnippet?: string | null;
  uiLanguagePrior?: UiLanguagePrior;
}): Promise<MultilingualPipelineResult> {
  const normalizedUserMessage = normalizeUserMessage(input.latestUserMessage);

  const detection = await detectLanguage({
    text: normalizedUserMessage,
    uiLanguagePrior: input.uiLanguagePrior ?? null,
    priorAssistantSnippet: input.priorAssistantSnippet ?? null,
  });

  const translation = await translateToEnglishQuery({
    text: normalizedUserMessage,
    ietfLanguageTag: detection.ietfLanguageTag,
    detectionConfidence: detection.detectionConfidence,
  });

  const corrected = applyReplyLanguageOverrides(
    {
      ietfLanguageTag: detection.ietfLanguageTag,
      englishRetrievalQuery: translation.englishRetrievalQuery,
      languageHintForPrompt: detection.languageHintForPrompt,
      translationConfidence: translation.translationConfidence,
      userStyleHint: detection.userStyleHint,
    },
    normalizedUserMessage,
    input.uiLanguagePrior ?? null,
  );

  return {
    ietfLanguageTag: corrected.ietfLanguageTag,
    englishRetrievalQuery: corrected.englishRetrievalQuery,
    languageHintForPrompt: corrected.languageHintForPrompt ?? languageHintForTag(corrected.ietfLanguageTag),
    translationConfidence: corrected.translationConfidence ?? translation.translationConfidence,
    userStyleHint: corrected.userStyleHint,
    detectorSource: detection.detectorSource,
    translatorSource: translation.translatorSource,
    normalizedUserMessage,
    queryExpansion: buildQueryExpansion(normalizedUserMessage, corrected.englishRetrievalQuery),
  };
}

/** Resolve language from user text via pipeline, or fall back to UI prior when no text. */
export async function resolveLanguageFromTextOrPrior(input: {
  userText?: string | null;
  uiLanguagePrior?: UiLanguagePrior;
  priorAssistantSnippet?: string | null;
}): Promise<{
  ietfLanguageTag: string;
  languageHintForPrompt: string;
  userStyleHint?: MultilingualPipelineResult["userStyleHint"];
  englishRetrievalQuery: string;
  queryExpansion: string;
  pipelineMeta?: Pick<
    MultilingualPipelineResult,
    "detectorSource" | "translatorSource" | "translationConfidence"
  >;
}> {
  const text = input.userText?.trim() ?? "";
  if (text && isMultilingualPipelineEnabled()) {
    const pipeline = await runMultilingualPipeline({
      latestUserMessage: text,
      priorAssistantSnippet: input.priorAssistantSnippet ?? null,
      uiLanguagePrior: input.uiLanguagePrior ?? null,
    });
    return {
      ietfLanguageTag: pipeline.ietfLanguageTag,
      languageHintForPrompt: pipeline.languageHintForPrompt ?? languageHintForTag(pipeline.ietfLanguageTag),
      userStyleHint: pipeline.userStyleHint,
      englishRetrievalQuery: pipeline.englishRetrievalQuery,
      queryExpansion: pipeline.queryExpansion,
      pipelineMeta: {
        detectorSource: pipeline.detectorSource,
        translatorSource: pipeline.translatorSource,
        translationConfidence: pipeline.translationConfidence,
      },
    };
  }

  const prior = input.uiLanguagePrior ?? "en";
  const tag = prior === "bn" ? "bn" : "en";
  const enQuery = text || "";
  return {
    ietfLanguageTag: tag,
    languageHintForPrompt: languageHintForTag(tag),
    englishRetrievalQuery: enQuery,
    queryExpansion: buildQueryExpansion(text, enQuery),
  };
}
