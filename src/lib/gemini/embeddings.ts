/** Gemini embeddings via REST (text-embedding-004, 768-D for pgvector). */

const DEFAULT_MODEL = "text-embedding-004";
export const GEMINI_EMBEDDING_DIMENSIONS = 768;

export function getEmbeddingModel(): string {
  return process.env.GEMINI_EMBEDDING_MODEL ?? DEFAULT_MODEL;
}

export async function embedText(text: string): Promise<number[]> {
  const [vec] = await embedTexts([text]);
  return vec;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const model = getEmbeddingModel();
  const out: number[][] = [];

  for (const text of texts) {
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

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini embedding failed: ${res.status} ${err}`);
    }

    const json = (await res.json()) as { embedding?: { values?: number[] } };
    const values = json.embedding?.values;
    if (!values?.length) {
      throw new Error("Gemini embedding returned no vector");
    }
    out.push(values);
  }

  return out;
}
