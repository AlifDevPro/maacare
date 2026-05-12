import { communityTrendingScore } from "@/lib/community/trending-score";

export type ViewerAffinity = {
  likedAuthorIds: Set<string>;
  kindEngagement: Map<string, number>;
};

type LikeRowEmbed = {
  community_posts?:
    | { author_id?: string; post_kind?: string }
    | { author_id?: string; post_kind?: string }[]
    | null;
};

/**
 * Builds lightweight personalization signals from posts the viewer recently liked.
 * Used for For You and trending ranking (deterministic tie-breakers live in the route).
 */
export function buildViewerAffinity(rows: LikeRowEmbed[] | null | undefined): ViewerAffinity {
  const likedAuthorIds = new Set<string>();
  const kindEngagement = new Map<string, number>();
  for (const row of rows ?? []) {
    const embed = row.community_posts;
    const posts = Array.isArray(embed) ? embed : embed ? [embed] : [];
    for (const p of posts) {
      const aid = p.author_id;
      if (typeof aid === "string" && aid.length > 0) likedAuthorIds.add(aid);
      const k = typeof p.post_kind === "string" && p.post_kind.length > 0 ? p.post_kind : "post";
      kindEngagement.set(k, (kindEngagement.get(k) ?? 0) + 1);
    }
  }
  return { likedAuthorIds, kindEngagement };
}

/** Ranking boost from authors/kinds the viewer has engaged with (likes). */
export function viewerPersonalizedBoost(input: {
  authorId: string;
  postKind: string;
  affinity: ViewerAffinity | null;
}): number {
  if (!input.affinity) return 0;
  let s = 0;
  if (input.affinity.likedAuthorIds.has(input.authorId)) s += 4;
  const kHits = input.affinity.kindEngagement.get(input.postKind) ?? 0;
  s += Math.min(5, kHits * 0.75);
  return s;
}

/** Small engagement signal to break ties after gestational distance (For You). */
export function forYouEngagementTiebreak(input: {
  likeCount: number;
  commentCount: number;
  createdAtIso: string;
}): number {
  return communityTrendingScore(input) * 0.08;
}
