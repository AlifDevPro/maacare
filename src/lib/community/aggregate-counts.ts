/** Group UUID list occurrences by id (for like/comment rows). */
export function countByPostId(rows: { post_id: string }[] | null): Record<string, number> {
  const m: Record<string, number> = {};
  for (const r of rows ?? []) {
    m[r.post_id] = (m[r.post_id] ?? 0) + 1;
  }
  return m;
}

export function escapeIlike(q: string): string {
  return q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
