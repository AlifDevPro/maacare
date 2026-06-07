/** When unset or "1", the CLD3 + Groq translation pipeline is active; set "0" to use legacy LLM prep. */
export function isMultilingualPipelineEnabled(): boolean {
  return process.env.MULTILINGUAL_PIPELINE_ENABLED !== "0";
}

export function getFastTextModelPath(): string | null {
  const path = process.env.FASTTEXT_MODEL_PATH?.trim();
  return path || null;
}
