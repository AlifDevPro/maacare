import { isMultilingualPipelineEnabled } from "@/lib/ai/multilingual-pipeline";
import { getGeminiApiKeys, getGroqApiKeys } from "./keys";
import {
  generateTextWithGeminiGroqFailover,
  generateTextWithGroqGeminiFailover,
  getChatModelName,
} from "./text-failover";

export { getChatModelName };

export async function generateChatReply(input: {
  systemInstruction: string;
  userMessage: string;
  temperature?: number;
}): Promise<string> {
  if (getGeminiApiKeys().length === 0 && getGroqApiKeys().length === 0) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  const out = isMultilingualPipelineEnabled()
    ? await generateTextWithGroqGeminiFailover({
        systemInstruction: input.systemInstruction,
        userMessage: input.userMessage,
        temperature: input.temperature,
      })
    : await generateTextWithGeminiGroqFailover({
        systemInstruction: input.systemInstruction,
        userMessage: input.userMessage,
        temperature: input.temperature,
      });
  return out.text;
}
