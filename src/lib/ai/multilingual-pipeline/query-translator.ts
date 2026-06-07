import { generateWithGroq, getGroqTranslateModelName } from "@/lib/gemini/text-failover";
import { getGroqApiKeys } from "@/lib/gemini/keys";

import { looksLikePredominantlyEnglishLatin, primaryTag } from "./language-heuristics";
import type { TranslatorSource } from "./types";

async function translateWithGroq(input: {
  text: string;
  sourceLang: string;
}): Promise<string | null> {
  const keys = getGroqApiKeys();
  if (keys.length === 0) return null;

  const systemInstruction = [
    "You translate user health questions into one concise English line for semantic search over an English medical corpus.",
    "Preserve drug names, conditions, symptom terms, numbers, and pregnancy week references.",
    "Output plain English only — no quotes, markdown, or commentary.",
    "If the text is already good English for search, return a cleaned-up version.",
  ].join("\n");

  const userMessage = `Source language tag: ${input.sourceLang}\nUser text:\n${input.text}`;

  for (const key of keys) {
    try {
      const out = await generateWithGroq(key, systemInstruction, userMessage, {
        temperature: 0.1,
        model: getGroqTranslateModelName(),
      });
      const trimmed = out.trim();
      if (trimmed) return trimmed;
    } catch {
      continue;
    }
  }
  return null;
}

function estimateTranslationQuality(input: {
  source: string;
  english: string;
  sourceLang: string;
}): number {
  const src = input.source.trim();
  const en = input.english.trim();
  if (!en) return 0.5;
  if (primaryTag(input.sourceLang) === "en") return 0.95;
  const hasNonAscii = /[^\x00-\x7F]/.test(src);
  const englishWords = (en.match(/[a-zA-Z]{2,}/g) ?? []).length;
  if (!hasNonAscii) return 0.9;
  if (englishWords < 2) return 0.62;
  if (englishWords >= 3) return 0.86;
  return 0.78;
}

export async function translateToEnglishQuery(input: {
  text: string;
  ietfLanguageTag: string;
  detectionConfidence: number;
}): Promise<{
  englishRetrievalQuery: string;
  translationConfidence: number;
  translatorSource: TranslatorSource;
}> {
  const trimmed = input.text.trim();
  if (!trimmed) {
    return {
      englishRetrievalQuery: "",
      translationConfidence: 0.5,
      translatorSource: "passthrough",
    };
  }

  const tag = primaryTag(input.ietfLanguageTag);
  if (tag === "en" || looksLikePredominantlyEnglishLatin(trimmed)) {
    return {
      englishRetrievalQuery: trimmed,
      translationConfidence: Math.max(0.9, input.detectionConfidence),
      translatorSource: "passthrough",
    };
  }

  const english = await translateWithGroq({ text: trimmed, sourceLang: tag });
  const translatorSource: TranslatorSource = english ? "groq" : "passthrough";
  const englishRetrievalQuery = english ?? trimmed;

  const translationConfidence = estimateTranslationQuality({
    source: trimmed,
    english: englishRetrievalQuery,
    sourceLang: tag,
  });

  return {
    englishRetrievalQuery,
    translationConfidence: Math.min(1, (translationConfidence + input.detectionConfidence) / 2),
    translatorSource,
  };
}
