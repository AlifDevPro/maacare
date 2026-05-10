import { cookies, headers } from "next/headers";

import CommunityPageClient, { type FeedPost } from "./page-client";

async function getInitialPosts(): Promise<FeedPost[]> {
  try {
    const h = await headers();
    const c = await cookies();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (!host) return [];
    const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
    const origin = `${proto}://${host}`;

    const res = await fetch(`${origin}/api/community/posts?limit=30`, {
      headers: { cookie: c.toString() },
      next: { revalidate: 30 },
    });

    if (!res.ok) return [];
    const data = (await res.json().catch(() => ({}))) as { posts?: FeedPost[] };
    return data.posts ?? [];
  } catch {
    return [];
  }
}

export default async function CommunityPage() {
  const initialPosts = await getInitialPosts();
  return <CommunityPageClient initialPosts={initialPosts} />;
}

