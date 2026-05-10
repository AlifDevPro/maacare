/** PostgREST / Postgres signals missing optional community columns (migration not applied). */
export function isMissingOptionalCommunityColumn(err: {
  message?: string;
  code?: string;
  details?: string;
} | null): boolean {
  if (!err) return false;
  const m = `${err.message ?? ""} ${err.details ?? ""}`;
  return (
    err.code === "42703" ||
    /post_kind|gestational_week_snapshot|community_post_likes|schema cache|PGRST205/i.test(m)
  );
}
