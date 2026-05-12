import { cookies, headers } from "next/headers";

import CommunityPageClient, { type FeedPost } from "./page-client";

async function getInitialFeed(): Promise<{
  posts: FeedPost[];
  hasMore: boolean;
  nextCursor: string | null;
}> {
  try {
    const h = await headers();
    const c = await cookies();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (!host) return { posts: [], hasMore: false, nextCursor: null };
    const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
    const origin = `${proto}://${host}`;

    const res = await fetch(`${origin}/api/community/posts?limit=15`, {
      headers: { cookie: c.toString() },
      cache: "no-store",
    });

    if (!res.ok) return { posts: [], hasMore: false, nextCursor: null };
    const data = (await res.json().catch(() => ({}))) as {
      posts?: FeedPost[];
      hasMore?: boolean;
      nextCursor?: string | null;
    };
    const posts = data.posts ?? [];
    const hasMore =
      typeof data.hasMore === "boolean" ? data.hasMore : posts.length >= 15;
    const nextCursor =
      hasMore && typeof data.nextCursor === "string" ? data.nextCursor : null;
    return { posts, hasMore, nextCursor };
  } catch {
    return { posts: [], hasMore: false, nextCursor: null };
  }
}

export default async function CommunityPage() {
  const { posts, hasMore, nextCursor } = await getInitialFeed();
  return (
    <CommunityPageClient
      initialPosts={posts}
      initialHasMore={hasMore}
      initialNextCursor={nextCursor}
    />
  );
}

