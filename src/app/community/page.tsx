"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { Heart, Loader2, MessageCircle, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
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

type FeedPost = {
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

function verified(role: string): boolean {
  return role === "moderator" || role === "admin";
}

function avatarLetter(name: string): string {
  const t = name.trim();
  return t ? t[0]!.toUpperCase() : "?";
}

export default function CommunityPage() {
  const { user } = useSession();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Posts");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 320);
    return () => clearTimeout(t);
  }, [search]);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tab === "Questions") params.set("kind", "question");
      if (tab === "Tips") params.set("kind", "tip");
      if (debouncedSearch) params.set("q", debouncedSearch);

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
      setLoading(false);
    }
  }, [tab, debouncedSearch]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    if (!editPost) return;
    setEditTitle(editPost.title ?? "");
    setEditBody(editPost.body);
    const k = editPost.postKind;
    setEditKind(k === "question" || k === "tip" ? k : "post");
  }, [editPost]);

  async function toggleLike(postId: string) {
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
      toast.error(err instanceof Error ? err.message : "Could not update like");
    }
  }

  async function submitPost() {
    if (!newBody.trim()) {
      toast.error("Write something for your post.");
      return;
    }
    setSaving(true);
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
      setComposeOpen(false);
      setNewTitle("");
      setNewBody("");
      setNewKind("post");
      await loadPosts();
    } catch (e) {
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
      await loadPosts();
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
      await loadPosts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete post");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppShell>
      <AppHeader
        title="Community"
        showNotifications
        right={
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
        }
      />

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
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setComposeOpen(false)}
              >
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
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void saveEdit();
            }}
          >
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={editKind} onValueChange={(v) => setEditKind(v as typeof editKind)}>
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
              <Label htmlFor="et">Title (optional)</Label>
              <Input
                id="et"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Short headline"
                className="rounded-xl"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="eb">Message</Label>
              <Textarea
                id="eb"
                rows={6}
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                className="rounded-xl"
                required
              />
            </div>
            <DialogFooter className="gap-2 pt-2 sm:gap-0">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEditPost(null)}>
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl" disabled={savingEdit}>
                {savingEdit ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  "Save"
                )}
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
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting…
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-4 px-4 pt-4">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-soft">
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
                tab === t ? "bg-card text-foreground shadow-soft" : "text-muted-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : posts.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground shadow-soft">
            No posts yet. Be the first to share — tap + to create one.
          </Card>
        ) : (
          <div className="space-y-3">
            {posts.map((p) => {
              const isOwner = user?.id === p.authorId;
              return (
                <Card
                  key={p.id}
                  className="relative overflow-hidden p-0 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card"
                >
                  {isOwner ? (
                    <div className="absolute right-2 top-3 z-10">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-full bg-card/80 backdrop-blur-sm"
                            aria-label="Post options"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="z-[100]">
                          <DropdownMenuItem onClick={() => setEditPost(p)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeletePost(p)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ) : null}
                  <Link
                    href={`/community/${p.id}`}
                    className={cn("block p-4 pb-2", isOwner && "pr-12")}
                  >
                    <div className="mb-2 flex items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft font-display text-sm font-semibold text-primary">
                        {avatarLetter(p.authorDisplayName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-semibold">{p.authorDisplayName}</p>
                          {verified(p.authorRole) && (
                            <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                              ✓ Verified
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {kindLabel(p.postKind)}
                          {p.gestationalWeekSnapshot != null
                            ? ` · Week ${p.gestationalWeekSnapshot}`
                            : ""}
                        </p>
                      </div>
                    </div>
                    {p.title ? (
                      <p className="mb-1 font-display text-sm font-semibold leading-snug">{p.title}</p>
                    ) : null}
                    <p className="line-clamp-4 text-sm leading-relaxed text-foreground/90">{p.body}</p>
                  </Link>
                  <div className="flex items-center gap-4 px-4 pb-4 pt-1 text-xs text-muted-foreground">
                    <button
                      type="button"
                      className={cn(
                        "flex items-center gap-1 rounded-lg px-1 py-0.5 transition-colors hover:text-primary",
                        p.likedByMe && "text-primary",
                      )}
                      onClick={() => void toggleLike(p.id)}
                    >
                      <Heart className={cn("h-3.5 w-3.5", p.likedByMe && "fill-current")} /> {p.likeCount}
                    </button>
                    <Link
                      href={`/community/${p.id}`}
                      className="flex items-center gap-1 rounded-lg px-1 py-0.5 transition-colors hover:text-primary"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> {p.commentCount}
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-card transition-transform hover:scale-105"
        aria-label="Create post"
        onClick={() => setComposeOpen(true)}
      >
        <Plus className="h-6 w-6" />
      </button>
    </AppShell>
  );
}
