/** Opaque cursor for community feed: offset into the sorted result set (see GET /api/community/posts). */
const MAX_OFFSET = 8000;

export function encodeFeedCursor(offset: number): string {
  const o = Math.min(Math.max(0, Math.floor(offset)), MAX_OFFSET);
  return Buffer.from(JSON.stringify({ o }), "utf8").toString("base64url");
}

export function decodeFeedCursor(cursor: string | null | undefined): number {
  if (!cursor?.trim()) return 0;
  try {
    const raw = Buffer.from(cursor.trim(), "base64url").toString("utf8");
    const j = JSON.parse(raw) as { o?: unknown };
    const n = typeof j.o === "number" ? j.o : Number(j.o);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(Math.floor(n), MAX_OFFSET);
  } catch {
    return 0;
  }
}
