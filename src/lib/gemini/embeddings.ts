/** Gemini embeddings via REST (text-embedding-004, 768-D for pgvector). */

import { getGeminiApiKeys } from "./keys";

const DEFAULT_MODEL = "text-embedding-004";
export const GEMINI_EMBEDDING_DIMENSIONS = 768;

export function getEmbeddingModel(): string {
  return process.env.GEMINI_EMBEDDING_MODEL ?? DEFAULT_MODEL;
}

function isEmbeddingRateLimited(status: number, body: string): boolean {
  if (status === 429) return true;
  const b = body.toLowerCase();
  return (
    b.includes("resource_exhausted") ||
    b.includes("quota") ||
    b.includes("rate limit") ||
    b.includes("429")
  );
}

export async function embedText(text: string): Promise<number[]> {
  const [vec] = await embedTexts([text]);
  return vec;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const model = getEmbeddingModel();
  const out: number[][] = [];

  for (const text of texts) {
    let lastErr: Error | null = null;
    let values: number[] | undefined;

    for (const key of keys) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: `models/${model}`,
            content: { parts: [{ text }] },
            outputDimensionality: GEMINI_EMBEDDING_DIMENSIONS,
          }),
        },
      );

      const errBody = await res.text();

      if (res.ok) {
        let json: { embedding?: { values?: number[] } };
        try {
          json = JSON.parse(errBody) as { embedding?: { values?: number[] } };
        } catch {
          lastErr = new Error("Gemini embedding returned invalid JSON");
          continue;
        }
        values = json.embedding?.values;
        if (values?.length) break;
        lastErr = new Error("Gemini embedding returned no vector");
        continue;
      }

      lastErr = new Error(`Gemini embedding failed: ${res.status} ${errBody}`);
      if (!isEmbeddingRateLimited(res.status, errBody)) {
        throw lastErr;
      }
    }

    if (!values?.length) {
      throw lastErr ?? new Error("Gemini embedding failed for all configured keys");
    }
    out.push(values);
  }

  return out;
}
