import { getGeminiApiKeys, getGroqApiKeys } from "./keys";
import { generateTextWithGeminiGroqFailover, getChatModelName } from "./text-failover";

export { getChatModelName };

export async function generateChatReply(input: {
  systemInstruction: string;
  userMessage: string;
}): Promise<string> {
  if (getGeminiApiKeys().length === 0 && getGroqApiKeys().length === 0) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  const out = await generateTextWithGeminiGroqFailover(input);
  return out.text;
}
