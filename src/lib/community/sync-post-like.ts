import { dispatchNotificationsUpdated } from "@/lib/notifications/events";

export type PostLikeState = {
  likedByMe: boolean;
  likeCount: number;
};

export type SyncPostLikeResult =
  | { ok: true; liked: boolean; likeCount: number }
  | { ok: false; message: string };

/** Idempotent like sync — sets absolute liked state (safe for debounced / rapid UI toggles). */
export async function syncPostLikeToServer(
  postId: string,
  liked: boolean,
): Promise<SyncPostLikeResult> {
  const res = await fetch(`/api/community/posts/${postId}/like`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ liked }),
  });
  const j = (await res.json().catch(() => ({}))) as {
    liked?: boolean;
    likeCount?: number;
    message?: string;
  };
  if (!res.ok) {
    return { ok: false, message: j.message ?? "Could not update like" };
  }
  if (j.liked) {
    dispatchNotificationsUpdated();
  }
  return {
    ok: true,
    liked: !!j.liked,
    likeCount: typeof j.likeCount === "number" ? j.likeCount : 0,
  };
}
