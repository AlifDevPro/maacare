import { GoogleGenerativeAI } from "@google/generative-ai";

import { getGeminiApiKeys, getGroqApiKeys } from "./keys";

export function getChatModelName(): string {
  return process.env.GEMINI_CHAT_MODEL ?? "gemini-2.5-flash";
}

export function getGroqVisionModelName(): string {
  return (
    process.env.GROQ_VISION_MODEL?.trim() || "meta-llama/llama-4-scout-17b-16e-instruct"
  );
}

/** Text model for report simplification (falls back to chat model). */
export function getGroqReportModelName(): string {
  return (
    process.env.GROQ_REPORT_MODEL?.trim() ||
    process.env.GROQ_CHAT_MODEL?.trim() ||
    "llama-3.3-70b-versatile"
  );
}

/** Primary Groq model for chat answers when multilingual pipeline is enabled. */
export function getGroqChatModelName(): string {
  return process.env.GROQ_CHAT_MODEL?.trim() || "llama-3.3-70b-versatile";
}

/** Groq model for query normalization and reply translate-back (defaults to fast 8B). */
export function getGroqTranslateModelName(): string {
  return (
    process.env.GROQ_TRANSLATE_MODEL?.trim() ||
    process.env.GROQ_CHAT_MODEL?.trim() ||
    "llama-3.1-8b-instant"
  );
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
  options?: { temperature?: number },
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: getChatModelName(),
    systemInstruction,
    ...(options?.temperature != null
      ? { generationConfig: { temperature: options.temperature } }
      : {}),
  });
  const result = await model.generateContent(userMessage);
  return result.response.text().trim();
}

/** Used by report analyze Groq text fallback (same env as chat). */
export async function generateWithGroq(
  apiKey: string,
  systemInstruction: string,
  userText: string,
  options?: { temperature?: number; model?: string },
): Promise<string> {
  const model = options?.model?.trim() || getGroqChatModelName();
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

const GROQ_VISION_OCR_PROMPT =
  "Extract all visible text from this medical or lab report image. Preserve numbers, units, reference ranges, test names, and dates. Output plain text only with no commentary.";

async function groqVisionChat(
  apiKey: string,
  systemInstruction: string | null,
  userContent: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  >,
  options?: { temperature?: number; maxTokens?: number; model?: string },
): Promise<string> {
  const messages: Array<{ role: string; content: string | typeof userContent }> = [];
  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }
  messages.push({ role: "user", content: userContent });

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options?.model ?? getGroqVisionModelName(),
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens ?? 4096,
      messages,
    }),
  });

  const payload = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  };
  if (!res.ok) {
    throw new Error(payload.error?.message ?? `groq_vision_http_${res.status}`);
  }
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("groq_vision_empty_response");
  return text;
}

/** OCR / text extraction from a report image via Groq Llama 4 vision. */
export async function extractTextWithGroqVision(
  apiKey: string,
  imageBase64: string,
  mimeType: string,
  prompt = GROQ_VISION_OCR_PROMPT,
): Promise<string> {
  const dataUri = `data:${mimeType};base64,${imageBase64}`;
  return groqVisionChat(
    apiKey,
    null,
    [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: dataUri } },
    ],
    { temperature: 0.1, maxTokens: 4096 },
  );
}

/** Full report analysis when only the image is available (Gemini multimodal fallback). */
export async function analyzeReportWithGroqVision(
  apiKey: string,
  systemInstruction: string,
  imageBase64: string,
  mimeType: string,
  contextText: string,
): Promise<string> {
  const dataUri = `data:${mimeType};base64,${imageBase64}`;
  return groqVisionChat(
    apiKey,
    systemInstruction,
    [
      {
        type: "text",
        text: `${contextText}\n\nAnalyze the attached report image and return STRICT JSON only.`,
      },
      { type: "image_url", image_url: { url: dataUri } },
    ],
    { temperature: 0.2, maxTokens: 4096 },
  );
}

export async function extractTextWithGroqVisionFailover(
  imageBase64: string,
  mimeType: string,
  minChars = 40,
): Promise<string | null> {
  for (const key of getGroqApiKeys()) {
    try {
      const text = await extractTextWithGroqVision(key, imageBase64, mimeType);
      const trimmed = text.trim();
      if (trimmed.length >= minChars) return trimmed;
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      if (!isRateLimitError(m)) break;
    }
  }
  return null;
}

export async function analyzeReportWithGroqVisionFailover(
  systemInstruction: string,
  imageBase64: string,
  mimeType: string,
  contextText: string,
): Promise<string | null> {
  for (const key of getGroqApiKeys()) {
    try {
      return await analyzeReportWithGroqVision(
        key,
        systemInstruction,
        imageBase64,
        mimeType,
        contextText,
      );
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      if (!isRateLimitError(m)) break;
    }
  }
  return null;
}

/**
 * Try each Gemini key in order; on rate limits continue to next key.
 * If all Gemini fail, try each Groq key the same way.
 */
export async function generateTextWithGeminiGroqFailover(input: {
  systemInstruction: string;
  userMessage: string;
  /** When set, both Gemini and Groq use this temperature (otherwise model defaults / Groq 0.4). */
  temperature?: number;
}): Promise<{ text: string; provider: "gemini" | "groq" }> {
  const errors: string[] = [];
  const temp = input.temperature;

  for (const key of getGeminiApiKeys()) {
    try {
      const reply = await generateWithGemini(key, input.systemInstruction, input.userMessage, {
        temperature: temp,
      });
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
      const reply = await generateWithGroq(key, input.systemInstruction, input.userMessage, {
        temperature: temp ?? 0.4,
      });
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

/**
 * Groq-first text generation; Gemini is the failover (multilingual pipeline answer step).
 */
export async function generateTextWithGroqGeminiFailover(input: {
  systemInstruction: string;
  userMessage: string;
  temperature?: number;
}): Promise<{ text: string; provider: "gemini" | "groq" }> {
  const errors: string[] = [];
  const temp = input.temperature;

  for (const key of getGroqApiKeys()) {
    try {
      const reply = await generateWithGroq(key, input.systemInstruction, input.userMessage, {
        temperature: temp ?? 0.4,
        model: getGroqChatModelName(),
      });
      if (reply) return { text: reply, provider: "groq" };
      errors.push("groq: empty response");
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      errors.push(`groq: ${m}`);
      if (!isRateLimitError(m)) break;
    }
  }

  for (const key of getGeminiApiKeys()) {
    try {
      const reply = await generateWithGemini(key, input.systemInstruction, input.userMessage, {
        temperature: temp,
      });
      if (reply) return { text: reply, provider: "gemini" };
      errors.push("gemini: empty response");
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      errors.push(`gemini: ${m}`);
      if (!isRateLimitError(m)) break;
    }
  }

  if (errors.length > 0 && errors.every((e) => isRateLimitError(e))) {
    throw new Error("all_providers_rate_limited");
  }
  throw new Error(`all_providers_failed: ${errors.join(" | ")}`);
}
