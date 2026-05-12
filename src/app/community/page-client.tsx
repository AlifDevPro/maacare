"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Heart,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { dispatchNotificationsUpdated } from "@/lib/notifications/events";
import { cn } from "@/lib/utils";

const TABS = ["Posts", "Questions", "Tips"] as const;

const FEED_SCROLL_KEY = "maacare:community-feed-scroll-y";

export type FeedPost = {
  id: string;
  authorId: string;
  title: string | null;
  body: string;
  postKind: string;
  gestationalWeekSnapshot: number | null;
  createdAt: string;
  authorDisplayName: string;
  authorRole: string;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
};

function kindLabel(kind: string): string {
  if (kind === "question") return "Question";
  if (kind === "tip") return "Tip";
  return "Post";
}

function avatarLetter(name: string): string {
  const t = name.trim();
  return t ? t[0]!.toUpperCase() : "?";
}

export default function CommunityPageClient({ initialPosts }: { initialPosts: FeedPost[] }) {
  const { user } = useSession();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Posts");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [posts, setPosts] = useState<FeedPost[]>(initialPosts);
  const [loading, setLoading] = useState(false);
  const usedInitialRef = useRef(true);
  const [composeOpen, setComposeOpen] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newKind, setNewKind] = useState<"post" | "question" | "tip">("post");
  const [saving, setSaving] = useState(false);

  const [editPost, setEditPost] = useState<FeedPost | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editKind, setEditKind] = useState<"post" | "question" | "tip">("post");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletePost, setDeletePost] = useState<FeedPost | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reportPost, setReportPost] = useState<FeedPost | null>(null);
  const [reportReason, setReportReason] = useState<
    "spam" | "abuse" | "harassment" | "misinformation" | "other"
  >("spam");
  const [reportDetails, setReportDetails] = useState("");
  const [reporting, setReporting] = useState(false);
  const [pendingLikeIds, setPendingLikeIds] = useState<Set<string>>(new Set());
  const [feedSort, setFeedSort] = useState<"new" | "trending">("new");
  const [forYouPosts, setForYouPosts] = useState<FeedPost[]>([]);
  const [forYouLoaded, setForYouLoaded] = useState(false);

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
    async (options?: { showLoader?: boolean }) => {
      const showLoader = options?.showLoader ?? true;
      if (showLoader) setLoading(true);
      try {
        const params = new URLSearchParams();
        if (tab === "Questions") params.set("kind", "question");
        if (tab === "Tips") params.set("kind", "tip");
        if (debouncedSearch) params.set("q", debouncedSearch);
        if (feedSort === "trending") params.set("sort", "trending");

        const res = await fetch(`/api/community/posts?${params.toString()}`, {
          credentials: "include",
        });

        if (res.status === 401) {
          toast.error("Please sign in to view community.");
          setPosts([]);
          return;
        }

        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(j.message ?? "Could not load posts");
        }

        const data = (await res.json()) as { posts: FeedPost[] };
        setPosts(data.posts ?? []);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load posts");
        setPosts([]);
      } finally {
        if (showLoader) setLoading(false);
      }
    },
    [tab, debouncedSearch, feedSort],
  );

  useEffect(() => {
    const onDefaultFeed = tab === "Posts" && !debouncedSearch && feedSort === "new";
    if (usedInitialRef.current && onDefaultFeed) {
      usedInitialRef.current = false;
      return;
    }
    void loadPosts();
  }, [loadPosts, tab, debouncedSearch, feedSort]);

  async function toggleLike(postId: string) {
    if (pendingLikeIds.has(postId)) return;
    const target = posts.find((p) => p.id === postId);
    if (!target) return;
    const nextLiked = !target.likedByMe;
    const optimisticCount = Math.max(0, target.likeCount + (nextLiked ? 1 : -1));
    setPendingLikeIds((prev) => new Set(prev).add(postId));
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, likedByMe: nextLiked, likeCount: optimisticCount } : p)),
    );
    try {
      const res = await fetch(`/api/community/posts/${postId}/like`, {
        method: "POST",
        credentials: "include",
      });
      const j = (await res.json().catch(() => ({}))) as {
        liked?: boolean;
        likeCount?: number;
        message?: string;
      };
      if (!res.ok) throw new Error(j.message ?? "Could not update like");
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                likedByMe: !!j.liked,
                likeCount: typeof j.likeCount === "number" ? j.likeCount : p.likeCount,
              }
            : p,
        ),
      );
      dispatchNotificationsUpdated();
    } catch (err) {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, likedByMe: target.likedByMe, likeCount: target.likeCount } : p,
        ),
      );
      toast.error(err instanceof Error ? err.message : "Could not update like");
    } finally {
      setPendingLikeIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  }

  async function submitPost() {
    if (!newBody.trim()) {
      toast.error("Write something for your post.");
      return;
    }
    setSaving(true);
    const tempId = `temp-${Date.now()}`;
    const optimistic: FeedPost = {
      id: tempId,
      authorId: user?.id ?? "me",
      title: newTitle.trim() || null,
      body: newBody.trim(),
      postKind: newKind,
      gestationalWeekSnapshot: null,
      createdAt: new Date().toISOString(),
      authorDisplayName: user?.name ?? "You",
      authorRole: user?.role ?? "user",
      likeCount: 0,
      commentCount: 0,
      likedByMe: false,
    };
    setPosts((prev) => [optimistic, ...prev]);
    setComposeOpen(false);
    setNewTitle("");
    setNewBody("");
    setNewKind("post");
    try {
      const res = await fetch("/api/community/posts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim() || null,
          body: newBody.trim(),
          postKind: newKind,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(j.message ?? "Could not publish");
      toast.success("Posted");
      void loadPosts({ showLoader: false });
    } catch (e) {
      setPosts((prev) => prev.filter((p) => p.id !== tempId));
      toast.error(e instanceof Error ? e.message : "Could not publish");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!editPost || !editBody.trim()) {
      toast.error("Message cannot be empty.");
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
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(j.message ?? "Could not update post");
      toast.success("Post updated");
      setEditPost(null);
      await loadPosts({ showLoader: false });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update post");
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
      toast.success("Post deleted");
      setDeletePost(null);
      await loadPosts({ showLoader: false });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete post");
    } finally {
      setDeleting(false);
    }
  }

  function openEditDialog(post: FeedPost) {
    setEditPost(post);
    setEditTitle(post.title ?? "");
    setEditBody(post.body);
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
      toast.success("Report submitted. Admin will review it.");
      setReportPost(null);
      setReportReason("spam");
      setReportDetails("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit report");
    } finally {
      setReporting(false);
    }
  }

  return (
    <AppShell>
      <AppHeader
        title="Community"
        showNotifications
        right={
          <div className="flex items-center gap-0.5">
            <Button asChild variant="ghost" size="sm" className="h-9 rounded-xl px-2 text-xs font-semibold">
              <Link href="/profile">Profile</Link>
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9"
              aria-label="New post"
              type="button"
              onClick={() => setComposeOpen(true)}
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        }
      />

      {/* dialogs unchanged */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-h-[90vh] gap-4 overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">New community post</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submitPost();
            }}
          >
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={newKind} onValueChange={(v) => setNewKind(v as typeof newKind)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[100]">
                  <SelectItem value="post">Post</SelectItem>
                  <SelectItem value="question">Question</SelectItem>
                  <SelectItem value="tip">Tip</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pt">Title (optional)</Label>
              <Input
                id="pt"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Short headline"
                className="rounded-xl"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pb">Message</Label>
              <Textarea
                id="pb"
                rows={6}
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder="Share kindly — this is not medical advice."
                className="rounded-xl"
                required
              />
            </div>
            <DialogFooter className="gap-2 pt-2 sm:gap-0">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setComposeOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publishing…
                  </>
                ) : (
                  "Publish"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
            <div className="grid gap-2">
              <Label htmlFor="eb">Message</Label>
              <Textarea id="eb" rows={6} value={editBody} onChange={(e) => setEditBody(e.target.value)} className="rounded-xl" required />
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

      <div className="space-y-4 px-4 pt-4">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            placeholder="Search posts…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 rounded-2xl bg-muted p-1">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                tab === t ? "bg-card text-foreground" : "text-muted-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-2 py-1.5">
          <span className="pl-2 text-xs font-medium text-muted-foreground">Sort</span>
          <div className="flex flex-1 gap-1">
            <button
              type="button"
              onClick={() => setFeedSort("new")}
              className={cn(
                "flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                feedSort === "new" ? "bg-primary-soft text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              New
            </button>
            <button
              type="button"
              onClick={() => setFeedSort("trending")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                feedSort === "trending"
                  ? "bg-primary-soft text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <TrendingUp className="h-3.5 w-3.5 shrink-0" />
              Trending
            </button>
          </div>
        </div>
        {forYouLoaded && forYouPosts.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 px-0.5 text-xs font-semibold text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
              Near your week
            </div>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {forYouPosts.map((p) => (
                <Link
                  key={p.id}
                  href={`/community/${p.id}`}
                  onClick={saveFeedScroll}
                  className="min-w-[220px] max-w-[78vw] shrink-0 rounded-2xl border border-border bg-card p-3 shadow-sm transition-colors hover:bg-muted/40"
                >
                  <p className="text-[11px] text-muted-foreground">
                    {kindLabel(p.postKind)}
                    {p.gestationalWeekSnapshot != null ? ` · Week ${p.gestationalWeekSnapshot}` : ""}
                  </p>
                  {p.title ? (
                    <p className="mt-1 line-clamp-2 font-display text-sm font-semibold leading-snug">{p.title}</p>
                  ) : null}
                  <p className={cn("mt-0.5 text-xs leading-relaxed text-foreground/85", p.title ? "line-clamp-2" : "line-clamp-3")}>
                    {p.body}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : posts.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">No posts yet. Be the first to share — tap + to create one.</Card>
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
                          <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-full bg-card/80 backdrop-blur-sm" aria-label="Post options">
                            <MoreHorizontal className="h-4 w-4" />
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
                    <Link
                      href={`/community/member/${p.authorId}`}
                      onClick={saveFeedScroll}
                      className="mb-2 flex items-center gap-2.5 rounded-xl py-0.5 outline-none ring-offset-background transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft font-display text-sm font-semibold text-primary">
                        {avatarLetter(p.authorDisplayName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-semibold">{p.authorDisplayName}</p>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {kindLabel(p.postKind)}
                          {p.gestationalWeekSnapshot != null ? ` · Week ${p.gestationalWeekSnapshot}` : ""}
                        </p>
                      </div>
                    </Link>
                    <Link
                      href={`/community/${p.id}`}
                      onClick={saveFeedScroll}
                      className="block rounded-lg outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {p.title ? <p className="mb-1 font-display text-sm font-semibold leading-snug">{p.title}</p> : null}
                      <p className="line-clamp-4 text-sm leading-relaxed text-foreground/90">{p.body}</p>
                    </Link>
                  </div>
                  <div className="flex items-center gap-4 px-4 pb-4 pt-1 text-xs text-muted-foreground">
                    <button
                      type="button"
                      className={cn(
                        "flex items-center gap-1 rounded-lg px-1 py-0.5 transition-colors hover:text-primary disabled:opacity-60",
                        p.likedByMe && "text-primary",
                      )}
                      onClick={() => void toggleLike(p.id)}
                      disabled={pendingLikeIds.has(p.id)}
                    >
                      <Heart className={cn("h-3.5 w-3.5", p.likedByMe && "fill-current")} /> {p.likeCount}
                    </button>
                    <Link
                      href={`/community/${p.id}`}
                      onClick={saveFeedScroll}
                      className="flex items-center gap-1 rounded-lg px-1 py-0.5 transition-colors hover:text-primary"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> {p.commentCount}
                    </Link>
                    {!isOwner ? (
                      <button
                        type="button"
                        className="flex items-center gap-1 rounded-lg px-1 py-0.5 transition-colors hover:text-destructive"
                        onClick={() => setReportPost(p)}
                      >
                        <Flag className="h-3.5 w-3.5" /> Report
                      </button>
                    ) : null}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground transition-transform hover:scale-105"
        aria-label="Create post"
        onClick={() => setComposeOpen(true)}
      >
        <Plus className="h-6 w-6" />
      </button>
    </AppShell>
  );
}

