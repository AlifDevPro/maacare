import {
  generateTextWithGeminiGroqFailover,
  generateTextWithGroqGeminiFailover,
} from "@/lib/gemini/text-failover";
import { withQualityRetry, type QualityEvaluation } from "@/lib/ai/quality-guard";
import { isMultilingualPipelineEnabled, postProcessMultilingualReply } from "@/lib/ai/multilingual-pipeline";
import type { UserStyleHint } from "@/lib/ai/multilingual-pipeline/types";

export async function generateLocalizedAiReply(input: {
  latestUserMessage: string;
  ietfLanguageTag: string;
  systemInstruction: string;
  userMessage: string;
  temperature?: number;
  minChars?: number;
  recoveryRule?: string;
  userStyleHint?: UserStyleHint;
  alignment?: {
    shortQuery?: boolean;
    identityTarget?: "assistant" | "user" | "none";
    userName?: string | null;
  };
  /** When true, always use Groq-primary generation (pipeline default). */
  groqPrimary?: boolean;
}): Promise<{
  reply: string;
  provider: "gemini" | "groq";
  retried: boolean;
  quality: QualityEvaluation;
  postProcessed: boolean;
}> {
  const useGroqPrimary = input.groqPrimary ?? isMultilingualPipelineEnabled();
  let providerUsed: "gemini" | "groq" = useGroqPrimary ? "groq" : "gemini";

  const qualityRun = await withQualityRetry({
    latestUserMessage: input.latestUserMessage,
    ietfLanguageTag: input.ietfLanguageTag,
    minChars: input.minChars,
    alignment: input.alignment,
    recoveryRule: input.recoveryRule,
    generator: async (extraRule?: string) => {
      const systemInstruction = extraRule
        ? `${input.systemInstruction}\n\n${extraRule}`
        : input.systemInstruction;
      const out = useGroqPrimary
        ? await generateTextWithGroqGeminiFailover({
            systemInstruction,
            userMessage: input.userMessage,
            temperature: input.temperature,
          })
        : await generateTextWithGeminiGroqFailover({
            systemInstruction,
            userMessage: input.userMessage,
            temperature: input.temperature,
          });
      providerUsed = out.provider;
      return out.text;
    },
  });

  if (!isMultilingualPipelineEnabled()) {
    return {
      reply: qualityRun.reply,
      provider: providerUsed,
      retried: qualityRun.retried,
      quality: qualityRun.quality,
      postProcessed: false,
    };
  }

  const post = await postProcessMultilingualReply({
    reply: qualityRun.reply,
    latestUserMessage: input.latestUserMessage,
    ietfLanguageTag: input.ietfLanguageTag,
    userStyleHint: input.userStyleHint,
  });

  return {
    reply: post.reply,
    provider: providerUsed,
    retried: qualityRun.retried,
    quality: qualityRun.quality,
    postProcessed: post.postProcessed,
  };
}
