import { z } from "zod";

import {
  applyReplyLanguageOverrides,
  IETF_LANGUAGE_TAG_RE,
  inferUserStyleHint,
  type MultilingualChatPrep,
} from "@/lib/ai/multilingual-pipeline/language-heuristics";
import { generateTextWithGeminiGroqFailover } from "@/lib/gemini/text-failover";

export type { MultilingualChatPrep };
export type UiLanguagePrior = "en" | "bn" | null;

export { applyReplyLanguageOverrides };

const multilingualPrepSchema = z.object({
  ietfLanguageTag: z.string().trim().min(2).max(35).regex(IETF_LANGUAGE_TAG_RE),
  englishRetrievalQuery: z.string().trim().max(4000),
  languageHintForPrompt: z.string().trim().max(200).optional(),
  translationConfidence: z.number().min(0).max(1).optional(),
  userStyleHint: z.enum(["native_script", "latin_transliteration", "mixed_code_switch"]).optional(),
});

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
    translationConfidence: 0.78,
  };
}

/**
 * @deprecated Use runMultilingualPipeline when MULTILINGUAL_PIPELINE_ENABLED is on.
 * Legacy LLM JSON prep — kept for rollback via MULTILINGUAL_PIPELINE_ENABLED=0.
 */
export async function prepareMultilingualChatTurn(input: {
  latestUserMessage: string;
  priorAssistantSnippet?: string | null;
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
    '  "translationConfidence": number in [0,1] indicating confidence that englishRetrievalQuery preserves user intent for English-only retrieval.',
    '  "userStyleHint": one of native_script, latin_transliteration, mixed_code_switch based on how the user typed this turn.',
    "Rules:",
    "- The LATEST user message is the source of truth for ietfLanguageTag. Use the prior assistant message only when the latest message is very short or ambiguous (e.g. ok, thanks, yes).",
    '- If the latest message is ordinary Latin-script English (clear English words and grammar), ietfLanguageTag MUST be "en". Do NOT set "bn" because the app is Bangladesh-focused, because the prior assistant was Bangla, or because the topic is pregnancy.',
    "- If the latest message contains Bengali script (Unicode Bengali range U+0980–U+09FF), prefer ietfLanguageTag \"bn\" unless the same turn is clearly another language.",
    '- If UI_LANGUAGE_PRIOR is present and the latest message is ambiguous, use it only as a tie-breaker (e.g. "thanks" + prior en -> "en").',
    "- Do not answer the medical question. Do not add keys beyond the five above.",
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
      ...(typeof data.data.translationConfidence === "number"
        ? { translationConfidence: data.data.translationConfidence }
        : {}),
      ...(data.data.userStyleHint
        ? { userStyleHint: data.data.userStyleHint }
        : { userStyleHint: inferUserStyleHint({ latestUserMessage: trimmed, ietfLanguageTag: tag }) }),
    };
    return applyReplyLanguageOverrides(rawPrep, trimmed, input.uiLanguagePrior ?? null);
  } catch {
    return applyReplyLanguageOverrides(fallbackPrep(trimmed), trimmed, input.uiLanguagePrior ?? null);
  }
}
