/**
 * Reads Gemini keys from env (same as before):
 * - GEMINI_API_KEYS: comma-separated list (tried in order)
 * - else GEMINI_API_KEY: single key
 */
export function getGeminiApiKeys(): string[] {
  const joined = process.env.GEMINI_API_KEYS?.trim();
  if (joined) {
    return joined
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }
  const single = process.env.GEMINI_API_KEY?.trim();
  return single ? [single] : [];
}

/**
 * Groq fallback keys:
 * - GROQ_API_KEYS: comma-separated
 * - else GROQ_API_KEY
 */
export function getGroqApiKeys(): string[] {
  const joined = process.env.GROQ_API_KEYS?.trim();
  if (joined) {
    return joined
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }
  const single = process.env.GROQ_API_KEY?.trim();
  return single ? [single] : [];
}
