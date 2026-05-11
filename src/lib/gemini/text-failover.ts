import { GoogleGenerativeAI } from "@google/generative-ai";

import { getGeminiApiKeys, getGroqApiKeys } from "./keys";

export function getChatModelName(): string {
  return process.env.GEMINI_CHAT_MODEL ?? "gemini-2.5-flash";
}

export function isRateLimitError(raw: string): boolean {
  const msg = raw.toLowerCase();
  return (
    msg.includes("resource_exhausted") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("429")
  );
}

async function generateWithGemini(
  apiKey: string,
  systemInstruction: string,
  userMessage: string,
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: getChatModelName(),
    systemInstruction,
  });
  const result = await model.generateContent(userMessage);
  return result.response.text().trim();
}

/** Used by report analyze Groq text fallback (same env as chat). */
export async function generateWithGroq(
  apiKey: string,
  systemInstruction: string,
  userText: string,
  options?: { temperature?: number },
): Promise<string> {
  const model = process.env.GROQ_CHAT_MODEL?.trim() || "llama-3.1-8b-instant";
  const temperature = options?.temperature ?? 0.4;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userText },
      ],
    }),
  });

  const payload = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  };
  if (!res.ok) {
    throw new Error(payload.error?.message ?? `groq_http_${res.status}`);
  }
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("groq_empty_response");
  return text;
}

/**
 * Try each Gemini key in order; on rate limits continue to next key.
 * If all Gemini fail, try each Groq key the same way.
 */
export async function generateTextWithGeminiGroqFailover(input: {
  systemInstruction: string;
  userMessage: string;
}): Promise<{ text: string; provider: "gemini" | "groq" }> {
  const errors: string[] = [];

  for (const key of getGeminiApiKeys()) {
    try {
      const reply = await generateWithGemini(key, input.systemInstruction, input.userMessage);
      if (reply) return { text: reply, provider: "gemini" };
      errors.push("gemini: empty response");
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      errors.push(`gemini: ${m}`);
      if (!isRateLimitError(m)) break;
    }
  }

  for (const key of getGroqApiKeys()) {
    try {
      const reply = await generateWithGroq(key, input.systemInstruction, input.userMessage);
      if (reply) return { text: reply, provider: "groq" };
      errors.push("groq: empty response");
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      errors.push(`groq: ${m}`);
      if (!isRateLimitError(m)) break;
    }
  }

  if (errors.length > 0 && errors.every((e) => isRateLimitError(e))) {
    throw new Error("all_providers_rate_limited");
  }
  throw new Error(`all_providers_failed: ${errors.join(" | ")}`);
}
