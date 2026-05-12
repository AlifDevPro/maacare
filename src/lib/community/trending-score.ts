/**
 * Engagement score with time decay for community "trending" sort (MVP heuristic).
 * Higher = more active recently.
 */
export function communityTrendingScore(input: {
  likeCount: number;
  commentCount: number;
  createdAtIso: string;
}): number {
  const created = new Date(input.createdAtIso).getTime();
  if (Number.isNaN(created)) return 0;
  const ageDays = Math.max(0, (Date.now() - created) / 86_400_000);
  const engagement = input.likeCount + 2 * input.commentCount;
  const decay = Math.pow(ageDays + 2, 1.35);
  return engagement / decay;
}
