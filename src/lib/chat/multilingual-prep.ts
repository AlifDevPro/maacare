import { z } from "zod";

import { generateTextWithGeminiGroqFailover } from "@/lib/gemini/text-failover";

/** Loose BCP-47 primary tag + optional subtags (ASCII letters/digits/hyphen). */
const IETF_LANGUAGE_TAG_RE = /^[a-z]{2,8}(-[a-zA-Z0-9]{1,8}){0,3}$/;

const multilingualPrepSchema = z.object({
  ietfLanguageTag: z.string().trim().min(2).max(35).regex(IETF_LANGUAGE_TAG_RE),
  englishRetrievalQuery: z.string().trim().max(4000),
  languageHintForPrompt: z.string().trim().max(200).optional(),
});

export type MultilingualChatPrep = z.infer<typeof multilingualPrepSchema>;

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

/**
 * One LLM call: infer reply language (BCP-47) and produce an English string suitable for embedding / RAG.
 * On parse or validation failure, falls back to English + raw message (safe for retrieval).
 */
export async function prepareMultilingualChatTurn(input: {
  latestUserMessage: string;
  /** Short prior assistant line helps disambiguate terse replies (e.g. "ok", "thanks"). */
  priorAssistantSnippet?: string | null;
}): Promise<MultilingualChatPrep> {
  const trimmed = input.latestUserMessage.trim();
  if (!trimmed) {
    return { ietfLanguageTag: "en", englishRetrievalQuery: "", languageHintForPrompt: "English" };
  }

  const prior =
    input.priorAssistantSnippet?.trim().slice(0, 600) ??
    null;

  const userBlock = [
    "LATEST_USER_MESSAGE:",
    trimmed,
    prior
      ? [
          "",
          "IMMEDIATELY_PRIOR_ASSISTANT_MESSAGE (for context only; infer language from LATEST_USER_MESSAGE):",
          prior,
        ].join("\n")
      : "",
  ].join("\n");

  try {
    const out = await generateTextWithGeminiGroqFailover({
      systemInstruction: [
        "You prepare metadata for a multilingual health assistant.",
        "Return a single JSON object only (no markdown, no prose) with exactly these keys:",
        '  "ietfLanguageTag": BCP-47 tag for the language the user is writing in on the latest turn (e.g. "en", "bn", "es", "ar", "hi-Latn").',
        '  "englishRetrievalQuery": one concise English line suitable for semantic search over an English-only medical corpus. Preserve drug names, conditions, and numbers. If the latest message is already good for English embedding, you may repeat it cleaned up.',
        '  "languageHintForPrompt": optional short English label for the answer model (e.g. "Bengali (Bangla)", "Spanish", "Hindi (Latin script)").',
        "Rules:",
        "- Infer language from the latest user message; use prior assistant only for ambiguous short replies.",
        '- If the latest message is English, set ietfLanguageTag to "en" and englishRetrievalQuery to the same intent in clear English.',
        "- Do not answer the medical question. Do not add keys beyond the three above.",
      ].join("\n"),
      userMessage: userBlock,
      temperature: 0.2,
    });

    const jsonStr = extractJsonObject(out.text);
    if (!jsonStr) return fallbackPrep(trimmed);

    const parsed = JSON.parse(jsonStr) as unknown;
    const data = multilingualPrepSchema.safeParse(parsed);
    if (!data.success) return fallbackPrep(trimmed);

    const q = data.data.englishRetrievalQuery.trim() || trimmed;
    const tag = data.data.ietfLanguageTag.trim().toLowerCase() || "en";
    const hint = data.data.languageHintForPrompt?.trim();

    return {
      ietfLanguageTag: tag,
      englishRetrievalQuery: q,
      ...(hint ? { languageHintForPrompt: hint } : {}),
    };
  } catch {
    return fallbackPrep(trimmed);
  }
}
