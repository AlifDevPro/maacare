/** Split long text into RAG-sized chunks (rough paragraphs, max size). */

const DEFAULT_MAX = 2000;

export function chunkText(text: string, maxChars = DEFAULT_MAX): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  function flush() {
    const t = current.trim();
    if (t) chunks.push(t);
    current = "";
  }

  for (const p of paragraphs) {
    const piece = p.trim();
    if (!piece) continue;

    if ((current + "\n\n" + piece).length > maxChars && current) {
      flush();
    }

    if (piece.length > maxChars) {
      flush();
      for (let i = 0; i < piece.length; i += maxChars) {
        chunks.push(piece.slice(i, i + maxChars));
      }
      continue;
    }

    current = current ? `${current}\n\n${piece}` : piece;
  }

  flush();
  return chunks;
}
