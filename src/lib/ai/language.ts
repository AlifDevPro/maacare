import {
  applyReplyLanguageOverrides,
  prepareMultilingualChatTurn,
  type MultilingualChatPrep,
  type UiLanguagePrior,
} from "@/lib/chat/multilingual-prep";

export type LanguageResolution = MultilingualChatPrep & {
  queryExpansion: string;
};

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

export function normalizeUiLanguagePrior(value: string | null | undefined): UiLanguagePrior {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v === "bn") return "bn";
  if (v === "en") return "en";
  return null;
}

function extractKeywordHints(text: string): string[] {
  const words = (text.toLowerCase().match(/[a-z][a-z0-9_-]{2,}/g) ?? []).filter(
    (w) => !STOPWORDS.has(w),
  );
  return Array.from(new Set(words)).slice(0, 8);
}

function buildQueryExpansion(latestUserMessage: string, englishRetrievalQuery: string): string {
  const query = englishRetrievalQuery.trim();
  if (!query) return latestUserMessage.trim();
  const hints = extractKeywordHints(latestUserMessage);
  if (hints.length === 0) return query;
  return `${query} | key terms: ${hints.join(", ")}`;
}

export function buildLanguagePromptLines(input: {
  ietfLanguageTag: string;
  languageHintForPrompt?: string | null;
}): string[] {
  const tag = input.ietfLanguageTag.trim().toLowerCase() || "en";
  const hint = input.languageHintForPrompt?.trim();

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
    "Use English context only for facts; do not expose translation or retrieval internals.",
  ];
}

export async function resolveLanguageForTurn(input: {
  latestUserMessage: string;
  priorAssistantSnippet?: string | null;
  uiLanguagePrior?: UiLanguagePrior;
}): Promise<LanguageResolution> {
  const prep = await prepareMultilingualChatTurn({
    latestUserMessage: input.latestUserMessage,
    priorAssistantSnippet: input.priorAssistantSnippet ?? null,
    uiLanguagePrior: input.uiLanguagePrior ?? null,
  });
  const corrected = applyReplyLanguageOverrides(
    prep,
    input.latestUserMessage,
    input.uiLanguagePrior ?? null,
  );

  return {
    ...corrected,
    queryExpansion: buildQueryExpansion(
      input.latestUserMessage,
      corrected.englishRetrievalQuery,
    ),
  };
}
