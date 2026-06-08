import { detectLanguage } from "./language-detector";
import { translateToEnglishQuery } from "./query-translator";
import { isMultilingualPipelineEnabled } from "./config";
import {
  finalizeConversationLanguage,
  tryResolveWithoutDetection,
  type ConversationLanguageSource,
} from "./conversation-language";
import {
  applyReplyLanguageOverrides,
  inferUserStyleHint,
  languageHintForTag,
} from "./language-heuristics";
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
export type { ConversationLanguageSource } from "./conversation-language";
export {
  detectExplicitLanguageSwitchRequest,
  finalizeConversationLanguage,
  inferConversationLanguageFromHistory,
  isShortLowInfoMessage,
  tryResolveWithoutDetection,
} from "./conversation-language";

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
  conversationLanguage?: string | null;
  recentUserMessages?: string[];
  appLanguage?: string | null;
  explicitUserLanguagePreference?: string | null;
}): Promise<
  MultilingualPipelineResult & {
    conversationLanguageSource: ConversationLanguageSource;
    updatedConversationLanguage: string;
  }
> {
  const normalizedUserMessage = normalizeUserMessage(input.latestUserMessage);

  const conversationInput = {
    latestUserMessage: normalizedUserMessage,
    conversationLanguage: input.conversationLanguage ?? null,
    recentUserMessages: input.recentUserMessages ?? [],
    priorAssistantSnippet: input.priorAssistantSnippet ?? null,
    uiLanguagePrior: input.uiLanguagePrior ?? null,
    appLanguage: input.appLanguage ?? null,
    explicitUserLanguagePreference: input.explicitUserLanguagePreference ?? null,
  };

  const preResolved = tryResolveWithoutDetection(conversationInput);
  let ietfLanguageTag: string;
  let detectionConfidence: number;
  let userStyleHint: MultilingualPipelineResult["userStyleHint"];
  let detectorSource: MultilingualPipelineResult["detectorSource"];
  let languageHintForPrompt: string;
  let conversationLanguageSource: ConversationLanguageSource;

  if (preResolved) {
    ietfLanguageTag = preResolved.ietfLanguageTag;
    detectionConfidence = 0.92;
    userStyleHint = inferUserStyleHint({
      latestUserMessage: normalizedUserMessage,
      ietfLanguageTag,
    });
    detectorSource =
      preResolved.source === "conversation_lock" ? "conversation_lock" : "heuristic";
    languageHintForPrompt = preResolved.languageHintForPrompt;
    conversationLanguageSource = preResolved.source;
  } else {
    const rawDetection = await detectLanguage({
      text: normalizedUserMessage,
      uiLanguagePrior: input.uiLanguagePrior ?? null,
      priorAssistantSnippet: input.priorAssistantSnippet ?? null,
    });
    const finalized = finalizeConversationLanguage({
      ...conversationInput,
      detectedTag: rawDetection.ietfLanguageTag,
      detectionConfidence: rawDetection.detectionConfidence,
    });
    ietfLanguageTag = finalized.ietfLanguageTag;
    detectionConfidence = rawDetection.detectionConfidence;
    userStyleHint = rawDetection.userStyleHint;
    detectorSource =
      finalized.source === "conversation_lock" ? "conversation_lock" : rawDetection.detectorSource;
    languageHintForPrompt = finalized.languageHintForPrompt;
    conversationLanguageSource = finalized.source;
  }

  const translation = await translateToEnglishQuery({
    text: normalizedUserMessage,
    ietfLanguageTag,
    detectionConfidence,
  });

  const corrected = applyReplyLanguageOverrides(
    {
      ietfLanguageTag,
      englishRetrievalQuery: translation.englishRetrievalQuery,
      languageHintForPrompt,
      translationConfidence: translation.translationConfidence,
      userStyleHint,
    },
    normalizedUserMessage,
    input.uiLanguagePrior ?? null,
  );

  const updatedConversationLanguage = finalizeConversationLanguage({
    ...conversationInput,
    detectedTag: corrected.ietfLanguageTag,
    detectionConfidence,
  }).updatedConversationLanguage;

  return {
    ietfLanguageTag: corrected.ietfLanguageTag,
    englishRetrievalQuery: corrected.englishRetrievalQuery,
    languageHintForPrompt: corrected.languageHintForPrompt ?? languageHintForTag(corrected.ietfLanguageTag),
    translationConfidence: corrected.translationConfidence ?? translation.translationConfidence,
    userStyleHint: corrected.userStyleHint,
    detectorSource,
    translatorSource: translation.translatorSource,
    normalizedUserMessage,
    queryExpansion: buildQueryExpansion(normalizedUserMessage, corrected.englishRetrievalQuery),
    conversationLanguageSource,
    updatedConversationLanguage,
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
