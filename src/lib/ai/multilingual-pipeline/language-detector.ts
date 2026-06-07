import type { DetectorSource, LanguageDetectionResult, UiLanguagePrior } from "./types";
import {
  applyReplyLanguageOverrides,
  containsBengaliScript,
  inferLanguageFromPriorSnippet,
  inferUserStyleHint,
  isAmbiguousShortReply,
  languageHintForTag,
  looksLikePredominantlyEnglishLatin,
  normalizeIetfTag,
  primaryTag,
} from "./language-heuristics";

type Cld3Identifier = {
  findLanguage: (text: string) => {
    language: string;
    probability: number;
    is_reliable: boolean;
  };
};

let cld3Promise: Promise<Cld3Identifier> | null = null;

async function getCld3Identifier(): Promise<Cld3Identifier> {
  if (!cld3Promise) {
    cld3Promise = (async () => {
      const mod = (await import("cld3-asm")) as {
        loadModule: () => Promise<{
          create: (minBytes: number, maxBytes: number) => Cld3Identifier;
        }>;
      };
      const factory = await mod.loadModule();
      return factory.create(0, 512);
    })();
  }
  return cld3Promise;
}

async function detectWithCld3(text: string): Promise<{
  tag: string;
  confidence: number;
  reliable: boolean;
} | null> {
  try {
    const identifier = await getCld3Identifier();
    const result = identifier.findLanguage(text);
    if (!result?.language) return null;
    return {
      tag: normalizeIetfTag(result.language),
      confidence: Math.max(0, Math.min(1, result.probability ?? 0)),
      reliable: Boolean(result.is_reliable),
    };
  } catch {
    return null;
  }
}

function detectWithHeuristics(text: string): { tag: string; confidence: number } {
  if (containsBengaliScript(text)) return { tag: "bn", confidence: 0.92 };
  if (looksLikePredominantlyEnglishLatin(text)) return { tag: "en", confidence: 0.9 };
  return { tag: "en", confidence: 0.55 };
}

export async function detectLanguage(input: {
  text: string;
  uiLanguagePrior?: UiLanguagePrior;
  priorAssistantSnippet?: string | null;
}): Promise<LanguageDetectionResult> {
  const trimmed = input.text.trim();
  if (!trimmed) {
    return {
      ietfLanguageTag: "en",
      detectionConfidence: 0.5,
      userStyleHint: "native_script",
      detectorSource: "heuristic",
      languageHintForPrompt: "English",
    };
  }

  let detectorSource: DetectorSource = "heuristic";
  let tag = "en";
  let confidence = 0.55;

  const cld3 = await detectWithCld3(trimmed);
  if (cld3) {
    detectorSource = "cld3";
    tag = cld3.tag;
    confidence = cld3.confidence;
    if (!cld3.reliable && cld3.confidence < 0.55) {
      const heuristic = detectWithHeuristics(trimmed);
      if (heuristic.confidence > cld3.confidence) {
        tag = heuristic.tag;
        confidence = heuristic.confidence;
        detectorSource = "heuristic";
      }
    }
  } else {
    const heuristic = detectWithHeuristics(trimmed);
    tag = heuristic.tag;
    confidence = heuristic.confidence;
    detectorSource = "heuristic";
  }

  if (isAmbiguousShortReply(trimmed)) {
    const priorLang = inferLanguageFromPriorSnippet(input.priorAssistantSnippet);
    if (priorLang && confidence < 0.75) {
      tag = priorLang;
      confidence = Math.max(confidence, 0.72);
    } else if (input.uiLanguagePrior && confidence < 0.7) {
      tag = input.uiLanguagePrior;
      confidence = Math.max(confidence, 0.7);
    }
  }

  const styleHint = inferUserStyleHint({ latestUserMessage: trimmed, ietfLanguageTag: tag });
  const corrected = applyReplyLanguageOverrides(
    {
      ietfLanguageTag: tag,
      englishRetrievalQuery: trimmed,
      languageHintForPrompt: languageHintForTag(tag),
      translationConfidence: confidence,
      userStyleHint: styleHint,
    },
    trimmed,
    input.uiLanguagePrior ?? null,
  );

  return {
    ietfLanguageTag: corrected.ietfLanguageTag,
    detectionConfidence: confidence,
    userStyleHint: corrected.userStyleHint ?? styleHint,
    detectorSource,
    languageHintForPrompt: corrected.languageHintForPrompt ?? languageHintForTag(corrected.ietfLanguageTag),
  };
}

/** Re-detect language on a generated reply (post-processor). */
export async function detectReplyLanguage(reply: string, expectedTag: string): Promise<{
  matches: boolean;
  detectedTag: string;
  confidence: number;
}> {
  const trimmed = reply.trim();
  if (!trimmed) return { matches: false, detectedTag: "en", confidence: 0 };
  const expected = primaryTag(expectedTag);
  if (expected === "en") {
    const latinHeavy = looksLikePredominantlyEnglishLatin(trimmed) || /^[\x00-\x7F\s\p{P}]+$/u.test(trimmed);
    return { matches: latinHeavy, detectedTag: "en", confidence: latinHeavy ? 0.9 : 0.4 };
  }

  const cld3 = await detectWithCld3(trimmed);
  const detected = cld3?.tag ?? detectWithHeuristics(trimmed).tag;
  const detectedPrimary = primaryTag(detected);
  const matches =
    detectedPrimary === expected ||
    (expected === "bn" && containsBengaliScript(trimmed)) ||
    (expected === "hi" && /[\u0900-\u097F]/.test(trimmed));

  return {
    matches,
    detectedTag: detected,
    confidence: cld3?.confidence ?? 0.6,
  };
}
