import { generateWithGroq, getGroqTranslateModelName } from "@/lib/gemini/text-failover";
import { getGroqApiKeys } from "@/lib/gemini/keys";
import {
  enforceNaturalResponseQuality,
  evaluateResponseQuality,
} from "@/lib/ai/quality-guard";

import { detectReplyLanguage } from "./language-detector";
import { languageHintForTag, primaryTag } from "./language-heuristics";
import type { UserStyleHint } from "./types";

async function translateReplyToTargetLanguage(input: {
  reply: string;
  ietfLanguageTag: string;
  userStyleHint?: UserStyleHint;
}): Promise<string | null> {
  const keys = getGroqApiKeys();
  if (keys.length === 0) return null;

  const tag = input.ietfLanguageTag.trim() || "en";
  if (primaryTag(tag) === "en") return input.reply;

  const systemInstruction = [
    "You translate a maternal-health assistant reply into the user's language.",
    "Preserve all medical facts, numbers, drug names, and safety guidance exactly.",
    "Do not add new medical advice. Keep tone warm and natural.",
    "Output plain text only — no markdown fences or JSON.",
    input.userStyleHint === "latin_transliteration"
      ? "Use Latin script transliteration matching how the user types Romanized Bangla/Hindi."
      : input.userStyleHint === "mixed_code_switch"
        ? "Preserve natural code-switching if present in the source."
        : "Use native script for the target language when appropriate.",
  ].join("\n");

  const userMessage = [
    `Target language (IETF): ${tag}`,
    `Language hint: ${languageHintForTag(tag)}`,
    "",
    "Reply to translate:",
    input.reply,
  ].join("\n");

  for (const key of keys) {
    try {
      const out = await generateWithGroq(key, systemInstruction, userMessage, {
        temperature: 0.2,
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

export async function postProcessMultilingualReply(input: {
  reply: string;
  latestUserMessage: string;
  ietfLanguageTag: string;
  userStyleHint?: UserStyleHint;
}): Promise<{ reply: string; postProcessed: boolean; reasons: string[] }> {
  let reply = enforceNaturalResponseQuality(input.reply, {
    fallback: "I can help with that. Could you share a bit more detail?",
  });

  const quality = evaluateResponseQuality({
    reply,
    latestUserMessage: input.latestUserMessage,
    ietfLanguageTag: input.ietfLanguageTag,
  });

  const tag = primaryTag(input.ietfLanguageTag);
  const needsLanguageFix =
    !quality.ok &&
    (quality.reasons.includes("language_drift") || quality.reasons.includes("style_drift"));

  let langCheck = await detectReplyLanguage(reply, input.ietfLanguageTag);
  const languageMismatch = tag !== "en" && !langCheck.matches;

  if (!needsLanguageFix && !languageMismatch) {
    return { reply, postProcessed: false, reasons: [] };
  }

  const translated = await translateReplyToTargetLanguage({
    reply,
    ietfLanguageTag: input.ietfLanguageTag,
    userStyleHint: input.userStyleHint,
  });

  if (!translated) {
    return { reply, postProcessed: false, reasons: quality.reasons };
  }

  reply = enforceNaturalResponseQuality(translated, { fallback: reply });
  langCheck = await detectReplyLanguage(reply, input.ietfLanguageTag);

  const q2 = evaluateResponseQuality({
    reply,
    latestUserMessage: input.latestUserMessage,
    ietfLanguageTag: input.ietfLanguageTag,
  });

  const improved = q2.ok || q2.confidence > quality.confidence || langCheck.matches;
  return {
    reply: improved ? reply : input.reply,
    postProcessed: improved,
    reasons: quality.reasons,
  };
}
