"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  Flag,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSession } from "@/lib/auth-client";
import { CommunityAvatar } from "@/components/community/community-avatar";
import { CommunityLikeButton } from "@/components/community/community-like-button";
import { CommunityAuthorBadges } from "@/components/community/community-author-badges";
import { CommunityPostBody } from "@/components/community/community-post-body";
import { CommunityRichEditor } from "@/components/community/community-rich-editor";
import { isRichPostBodyEmpty } from "@/lib/community/rich-post-empty";
import { cn } from "@/lib/utils";
import { COMMUNITY_ACTION, COMMUNITY_ACTION_ICON } from "@/lib/community/action-row-styles";
import { useCommunityFeedRealtime } from "@/hooks/use-community-feed-realtime";
import { useTranslation } from "react-i18next";

const FEED_SCROLL_KEY = "maacare:community-feed-scroll-y";
const FEED_PAGE_SIZE = 15;

function CommunityFeedSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="overflow-hidden p-0">
          <div className="px-4 pb-2 pt-4">
            <div className="mb-2 flex items-center gap-2.5">
              <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-28 rounded-md" />
                <Skeleton className="h-3 w-36 rounded-md" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4 max-w-[18rem] rounded-md" />
              <Skeleton className="h-3 w-full rounded-md" />
              <Skeleton className="h-3 w-[92%] rounded-md" />
            </div>
          </div>
          <div className="flex gap-2 px-4 pb-3 pt-1">
            <Skeleton className="h-8 w-16 rounded-lg" />
            <Skeleton className="h-8 w-16 rounded-lg" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export type FeedPost = {
  id: string;
  authorId: string;
  title: string | null;
  body: string;
  bodyFormat?: "plain" | "html";
  postKind: string;
  gestationalWeekSnapshot: number | null;
  createdAt: string;
  authorDisplayName: string;
  authorRole: string;
  authorAvatarUrl?: string | null;
  authorProfession?: string | null;
  authorVerifiedProfessional?: boolean;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
};

function kindLabel(kind: string): string {
  if (kind === "question") return "Question";
  if (kind === "tip") return "Tip";
  return "Post";
}

function ForYouPostCard({
  post,
  className,
  onNavigate,
}: {
  post: FeedPost;
  className?: string;
  onNavigate: () => void;
}) {
  return (
    <Card
      className={cn(
        "min-w-0 overflow-hidden shadow-sm transition-shadow hover:shadow-md",
        className,
      )}
    >
      <Link
        href={`/community/${post.id}`}
        onClick={onNavigate}
        className="block min-w-0 break-words p-3 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
      >
        <p className="text-[11px] text-muted-foreground">
          {kindLabel(post.postKind)}
          {post.gestationalWeekSnapshot != null ? ` · Week ${post.gestationalWeekSnapshot}` : ""}
        </p>
        {post.title ? (
          <p className="mt-1 line-clamp-2 font-display text-sm font-semibold leading-snug text-foreground">
            {post.title}
          </p>
        ) : null}
        <div className={cn("mt-0.5 min-w-0", post.title && "line-clamp-2")}>
          <CommunityPostBody body={post.body} bodyFormat={post.bodyFormat} variant="compact" />
        </div>
      </Link>
    </Card>
  );
}

function ForYouPostsSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="min-w-0 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="min-w-0 overflow-hidden p-3 shadow-sm">
          <Skeleton className="h-3 w-24 rounded-md" />
          <Skeleton className="mt-2 h-4 w-full rounded-md" />
          <Skeleton className="mt-1.5 h-3 w-full rounded-md" />
          <Skeleton className="mt-1 h-3 w-[85%] rounded-md" />
        </Card>
      ))}
    </div>
  );
}

function ForYouPostsRow({
  posts,
  onNavigate,
}: {
  posts: FeedPost[];
  onNavigate: () => void;
}) {
  const count = posts.length;

  if (count === 1) {
    return (
      <div className="min-w-0">
        <ForYouPostCard post={posts[0]!} className="w-full" onNavigate={onNavigate} />
      </div>
    );
  }

  if (count === 2) {
    return (
      <div className="min-w-0 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {posts.map((p) => (
          <ForYouPostCard key={p.id} post={p} className="w-full min-w-0" onNavigate={onNavigate} />
        ))}
      </div>
    );
  }

  return (
    <div className="min-w-0 overflow-hidden">
      <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
        {posts.map((p) => (
          <ForYouPostCard
            key={p.id}
            post={p}
            className="w-[88%] max-w-[18rem] shrink-0 snap-start sm:w-[calc(50%-0.25rem)] sm:max-w-none"
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  );
}

export default function CommunityPageClient({
  initialPosts,
  initialHasMore,
  initialNextCursor,
}: {
  initialPosts: FeedPost[];
  initialHasMore: boolean;
  initialNextCursor: string | null;
}) {
  const { t } = useTranslation("community");
  const router = useRouter();
  const { user } = useSession();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [posts, setPosts] = useState<FeedPost[]>(initialPosts);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const usedInitialRef = useRef(true);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const nextCursorRef = useRef<string | null>(initialNextCursor);
  const hasMoreRef = useRef(initialHasMore);
  const loadingRef = useRef(false);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    nextCursorRef.current = nextCursor;
  }, [nextCursor]);
  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);
  useEffect(() => {
    loadingMoreRef.current = loadingMore;
  }, [loadingMore]);

  const [editPost, setEditPost] = useState<FeedPost | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editKind, setEditKind] = useState<"post" | "question" | "tip">("post");
  const [editRich, setEditRich] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletePost, setDeletePost] = useState<FeedPost | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reportPost, setReportPost] = useState<FeedPost | null>(null);
  const [reportReason, setReportReason] = useState<
    "spam" | "abuse" | "harassment" | "misinformation" | "other"
  >("spam");
  const [reportDetails, setReportDetails] = useState("");
  const [reporting, setReporting] = useState(false);
  const [feedSort, setFeedSort] = useState<"new" | "trending">("new");
  const [forYouPosts, setForYouPosts] = useState<FeedPost[]>([]);
  const [forYouLoaded, setForYouLoaded] = useState(false);
  const [feedRemoteHint, setFeedRemoteHint] = useState(false);

  const saveFeedScroll = useCallback(() => {
    try {
      sessionStorage.setItem(FEED_SCROLL_KEY, String(window.scrollY));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(FEED_SCROLL_KEY);
      if (raw == null) return;
      const y = Number(raw);
      sessionStorage.removeItem(FEED_SCROLL_KEY);
      if (Number.isNaN(y)) return;
      requestAnimationFrame(() => {
        window.scrollTo({ top: y, behavior: "auto" });
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/community/posts?forYou=1&limit=12", { credentials: "include" });
        if (!res.ok) {
          if (!cancelled) setForYouLoaded(true);
          return;
        }
        const data = (await res.json()) as { posts: FeedPost[] };
        if (!cancelled) {
          setForYouPosts(data.posts ?? []);
          setForYouLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setForYouPosts([]);
          setForYouLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 320);
    return () => clearTimeout(t);
  }, [search]);

  const loadPosts = useCallback(
    async (options?: { showLoader?: boolean; append?: boolean; cursor?: string | null }) => {
      const append = options?.append ?? false;
      const showLoader = options?.showLoader ?? !append;
      if (showLoader && !append) setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", String(FEED_PAGE_SIZE));
        if (debouncedSearch) params.set("q", debouncedSearch);
        if (feedSort === "trending") params.set("sort", "trending");
        if (append && options?.cursor) params.set("cursor", options.cursor);

        const res = await fetch(`/api/community/posts?${params.toString()}`, {
          credentials: "include",
        });

        if (res.status === 401) {
          toast.error(t("toast_sign_in"));
          setPosts([]);
          setHasMore(false);
          setNextCursor(null);
          return;
        }

        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(j.message ?? t("toast_load_posts"));
        }

        const data = (await res.json()) as {
          posts: FeedPost[];
          hasMore?: boolean;
          nextCursor?: string | null;
        };
        const chunk = data.posts ?? [];
        if (append) {
          setPosts((prev) => {
            const seen = new Set(prev.map((p) => p.id));
            const add = chunk.filter((p) => !seen.has(p.id));
            return [...prev, ...add];
          });
        } else {
          setPosts(chunk);
        }
        const hm = !!data.hasMore;
        setHasMore(hm);
        setNextCursor(hm && typeof data.nextCursor === "string" ? data.nextCursor : null);
        setFeedRemoteHint(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("toast_load_posts"));
        if (!append) {
          setPosts([]);
          setHasMore(false);
          setNextCursor(null);
        } else {
          setHasMore(false);
          setNextCursor(null);
        }
      } finally {
        if (showLoader && !append) setLoading(false);
      }
    },
    [debouncedSearch, feedSort, t],
  );

  useEffect(() => {
    const el = loadMoreSentinelRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (!hasMoreRef.current || !nextCursorRef.current) return;
        if (loadingRef.current || loadingMoreRef.current) return;

        void (async () => {
          loadingMoreRef.current = true;
          setLoadingMore(true);
          try {
            await loadPosts({
              append: true,
              cursor: nextCursorRef.current,
              showLoader: false,
            });
          } finally {
            loadingMoreRef.current = false;
            setLoadingMore(false);
          }
        })();
      },
      { root: null, rootMargin: "280px", threshold: 0 },
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [loadPosts, posts.length, debouncedSearch, feedSort, hasMore, nextCursor]);

  const feedRealtimeEnabled = Boolean(user?.id && !debouncedSearch && feedSort === "new");

  useCommunityFeedRealtime(feedRealtimeEnabled, () => setFeedRemoteHint(true));

  useEffect(() => {
    if (!feedRealtimeEnabled) setFeedRemoteHint(false);
  }, [feedRealtimeEnabled]);

  useEffect(() => {
    const onDefaultFeed = !debouncedSearch && feedSort === "new";
    if (usedInitialRef.current && onDefaultFeed) {
      usedInitialRef.current = false;
      return;
    }
    void loadPosts();
  }, [loadPosts, debouncedSearch, feedSort]);

  const handleLikeUpdate = useCallback(
    (postId: string, patch: { likedByMe: boolean; likeCount: number }) => {
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...patch } : p)));
    },
    [],
  );

  async function saveEdit() {
    if (!editPost || (editRich ? isRichPostBodyEmpty(editBody) : !editBody.trim())) {
      toast.error(t("toast_empty_message"));
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/community/posts/${editPost.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim() ? editTitle.trim() : null,
          body: editBody.trim(),
          postKind: editKind,
          bodyFormat: editRich ? "html" : "plain",
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(j.message ?? "Could not update post");
      setEditPost(null);
      await loadPosts({ showLoader: false });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("toast_update_post"));
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmDelete() {
    if (!deletePost) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/community/posts/${deletePost.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(j.message ?? "Could not delete post");
      setDeletePost(null);
      await loadPosts({ showLoader: false });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("toast_delete_post"));
    } finally {
      setDeleting(false);
    }
  }

  function openEditDialog(post: FeedPost) {
    setEditPost(post);
    setEditTitle(post.title ?? "");
    setEditBody(post.body);
    setEditRich(post.bodyFormat === "html");
    const k = post.postKind;
    setEditKind(k === "question" || k === "tip" ? k : "post");
  }

  async function submitReport() {
    if (!reportPost) return;
    setReporting(true);
    try {
      const res = await fetch(`/api/community/posts/${reportPost.id}/report`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reportReason, details: reportDetails.trim() || undefined }),
      });
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(j.message ?? "Could not submit report");
      setReportPost(null);
      setReportReason("spam");
      setReportDetails("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("toast_report"));
    } finally {
      setReporting(false);
    }
  }

  function openCreatePost() {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent("/community/create")}`);
      return;
    }
    router.push("/community/create");
  }

  return (
    <AppShell>
      <AppHeader title={t("title")} showNotifications />

      <Dialog open={!!editPost} onOpenChange={(o) => !o && setEditPost(null)}>
        <DialogContent className="max-h-[90vh] gap-4 overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Edit post</DialogTitle>
          </DialogHeader>
          <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); void saveEdit(); }}>
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={editKind} onValueChange={(v) => setEditKind(v as typeof editKind)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent position="popper" className="z-[100]">
                  <SelectItem value="post">Post</SelectItem>
                  <SelectItem value="question">Question</SelectItem>
                  <SelectItem value="tip">Tip</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="et">Title (optional)</Label>
              <Input id="et" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Short headline" className="rounded-xl" />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/80 px-3 py-2">
              <div>
                <Label htmlFor="edit-rich" className="text-sm font-medium">
                  Rich text and photos
                </Label>
                <p className="text-[11px] text-muted-foreground">Bold, lists, and images from your device.</p>
              </div>
              <Switch
                id="edit-rich"
                checked={editRich}
                disabled={!user?.id}
                onCheckedChange={(c) => {
                  if (c) {
                    setEditRich(true);
                    setEditBody((prev) => {
                      const t = prev.trim();
                      if (!t) return "<p></p>";
                      if (/<[a-z][\s\S]*>/i.test(prev)) return prev;
                      const esc = t
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;");
                      return `<p>${esc.replace(/\n\n+/g, "</p><p>").replace(/\n/g, "<br/>")}</p>`;
                    });
                  } else {
                    setEditRich(false);
                    setEditBody((prev) =>
                      prev
                        .replace(/<br\s*\/?>/gi, "\n")
                        .replace(/<\/p>/gi, "\n\n")
                        .replace(/<[^>]+>/g, " ")
                        .replace(/\s+/g, " ")
                        .trim(),
                    );
                  }
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="eb">Message</Label>
              {editRich && user?.id && editPost ? (
                <CommunityRichEditor
                  key={`edit-${editPost.id}-${editRich}`}
                  userId={user.id}
                  content={editBody}
                  onChange={setEditBody}
                />
              ) : (
                <Textarea
                  id="eb"
                  rows={6}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  className="rounded-xl"
                />
              )}
            </div>
            <DialogFooter className="gap-2 pt-2 sm:gap-0">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEditPost(null)}>Cancel</Button>
              <Button type="submit" className="rounded-xl" disabled={savingEdit}>
                {savingEdit ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletePost} onOpenChange={(o) => !o && !deleting && setDeletePost(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes your post and its replies from the community. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={deleting} onClick={() => void confirmDelete()}>
              {deleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting…</> : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!reportPost} onOpenChange={(o) => !o && !reporting && setReportPost(null)}>
        <DialogContent className="max-h-[90vh] gap-4 overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Report post</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submitReport();
            }}
          >
            <div className="grid gap-2">
              <Label>Reason</Label>
              <Select
                value={reportReason}
                onValueChange={(v) => setReportReason(v as typeof reportReason)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[100]">
                  <SelectItem value="spam">Spam</SelectItem>
                  <SelectItem value="abuse">Abuse</SelectItem>
                  <SelectItem value="harassment">Harassment</SelectItem>
                  <SelectItem value="misinformation">Misinformation</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="report-details">Details (optional)</Label>
              <Textarea
                id="report-details"
                rows={4}
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Add context for admins..."
                className="rounded-xl"
              />
            </div>
            <DialogFooter className="gap-2 pt-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setReportPost(null)}
                disabled={reporting}
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl" disabled={reporting}>
                {reporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
                  </>
                ) : (
                  "Submit report"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="min-w-0 space-y-4 px-0 pt-4">
        {feedRemoteHint ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary-soft/50 px-3 py-2.5 shadow-sm">
            <p className="text-sm font-medium text-foreground">New activity on the feed</p>
            <Button
              type="button"
              size="sm"
              className="shrink-0 rounded-xl"
              onClick={() => {
                void loadPosts({ showLoader: false });
              }}
            >
              Refresh
            </Button>
          </div>
        ) : null}
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            placeholder="Search posts…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => openCreatePost()}
          className="flex w-full min-h-[3.25rem] items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left shadow-sm transition-transform duration-150 ease-out active:scale-[0.99] hover:bg-muted/40 motion-reduce:active:scale-100"
        >
          <CommunityAvatar
            url={user?.avatarUrl}
            name={user?.name ?? "You"}
            className="h-10 w-10 shrink-0"
            fallbackClassName="bg-primary-soft text-sm font-semibold"
          />
          <span className="min-w-0 flex-1 truncate rounded-full border border-border/60 bg-muted/40 px-4 py-2.5 text-left text-sm text-muted-foreground">
            Share anything…
          </span>
        </button>
        <div className="flex border-b border-border">
          <button
            type="button"
            onClick={() => setFeedSort("new")}
            className={cn(
              "min-h-11 flex-1 border-b-2 py-2.5 text-xs font-semibold transition-[transform,colors] duration-150 active:scale-[0.98] motion-reduce:active:scale-100",
              feedSort === "new"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            New
          </button>
          <button
            type="button"
            onClick={() => setFeedSort("trending")}
            className={cn(
              "flex min-h-11 flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 text-xs font-semibold transition-[transform,colors] duration-150 active:scale-[0.98] motion-reduce:active:scale-100",
              feedSort === "trending"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <TrendingUp className="h-4 w-4 shrink-0" />
            Trending
          </button>
        </div>
        {user && !forYouLoaded ? (
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-1.5 px-0.5 text-xs font-semibold text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
              Near your week
            </div>
            <ForYouPostsSkeleton />
          </div>
        ) : null}
        {forYouLoaded && forYouPosts.length > 0 ? (
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-1.5 px-0.5 text-xs font-semibold text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
              Near your week
            </div>
            <ForYouPostsRow posts={forYouPosts} onNavigate={saveFeedScroll} />
          </div>
        ) : null}
        {loading ? (
          <CommunityFeedSkeleton />
        ) : posts.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No posts yet. Be the first to share — tap above to start a post.
          </Card>
        ) : (
          <div className="space-y-3">
            {posts.map((p) => {
              const isOwner = user?.id === p.authorId;
              return (
                <Card key={p.id} className="relative overflow-hidden p-0 transition-all">
                  {isOwner ? (
                    <div className="absolute right-2 top-3 z-10">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" size="icon" variant="ghost" className="rounded-full bg-card/80 backdrop-blur-sm" aria-label="Post options">
                            <MoreHorizontal className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="z-[100]">
                          <DropdownMenuItem onClick={() => openEditDialog(p)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeletePost(p)}><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ) : null}
                  <div className={cn("px-4 pb-2 pt-4", isOwner && "pr-12")}>
                    <div className="mb-2 flex items-start gap-2.5">
                      <Link
                        href={`/community/member/${p.authorId}`}
                        onClick={saveFeedScroll}
                        className="shrink-0 pt-0.5 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <CommunityAvatar
                          url={p.authorAvatarUrl}
                          name={p.authorDisplayName}
                          className="h-10 w-10 sm:h-11 sm:w-11"
                          fallbackClassName="bg-primary-soft text-sm font-semibold"
                        />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <CommunityAuthorBadges
                          authorId={p.authorId}
                          authorDisplayName={p.authorDisplayName}
                          authorRole={p.authorRole}
                          authorProfession={p.authorProfession}
                          authorVerifiedProfessional={p.authorVerifiedProfessional}
                          timeLabel={formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}
                        />
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {kindLabel(p.postKind)}
                          {p.gestationalWeekSnapshot != null ? ` · Week ${p.gestationalWeekSnapshot}` : ""}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/community/${p.id}`}
                      onClick={saveFeedScroll}
                      className="block rounded-lg outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {p.title ? <p className="mb-1 font-display text-sm font-semibold leading-snug">{p.title}</p> : null}
                      <div className="line-clamp-4 text-sm leading-relaxed text-foreground/90 [&_.prose]:line-clamp-4">
                        <CommunityPostBody body={p.body} bodyFormat={p.bodyFormat} collapseLines={4} />
                      </div>
                    </Link>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 px-2 pb-3 pt-1 sm:px-4">
                    <CommunityLikeButton
                      postId={p.id}
                      likedByMe={p.likedByMe}
                      likeCount={p.likeCount}
                      onUpdate={handleLikeUpdate}
                    />
                    <Link
                      href={`/community/${p.id}`}
                      onClick={saveFeedScroll}
                      className={cn(COMMUNITY_ACTION, "text-muted-foreground no-underline")}
                      aria-label={`${p.commentCount} comments`}
                    >
                      <MessageCircle className={cn("h-5 w-5", COMMUNITY_ACTION_ICON)} />
                      <span>{p.commentCount}</span>
                    </Link>
                    {!isOwner ? (
                      <button
                        type="button"
                        className={cn(COMMUNITY_ACTION, "text-muted-foreground hover:text-destructive")}
                        onClick={() => setReportPost(p)}
                        aria-label="Report post"
                      >
                        <Flag className={cn("h-5 w-5", COMMUNITY_ACTION_ICON)} />
                        <span>Report</span>
                      </button>
                    ) : null}
                  </div>
                </Card>
              );
            })}
            {hasMore ? <div ref={loadMoreSentinelRef} className="h-8 w-full shrink-0" aria-hidden /> : null}
            {loadingMore ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
              </div>
            ) : null}
          </div>
        )}
      </div>
    </AppShell>
  );
}

