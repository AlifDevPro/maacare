"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { formatDistanceToNow } from "date-fns";
import { Heart, Loader2, MessageCircle, MoreHorizontal, Pencil, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { dispatchNotificationsUpdated } from "@/lib/notifications/events";
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
import { cn } from "@/lib/utils";

type PostPayload = {
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

type CommentRow = {
  id: string;
  body: string;
  createdAt: string;
  authorDisplayName: string;
  authorRole: string;
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useSession();
  const rawId = typeof params.postId === "string" ? params.postId : "";

  const [post, setPost] = useState<PostPayload | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editKind, setEditKind] = useState<"post" | "question" | "tip">("post");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const validId = UUID_RE.test(rawId);

  const loadAll = useCallback(async () => {
    if (!validId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [rp, rc] = await Promise.all([
        fetch(`/api/community/posts/${rawId}`, { credentials: "include" }),
        fetch(`/api/community/posts/${rawId}/comments`, { credentials: "include" }),
      ]);

      if (rp.status === 401) {
        toast.error("Please sign in.");
        router.replace("/login?next=/community");
        return;
      }

      if (rp.status === 404) {
        setPost(null);
        setComments([]);
        return;
      }

      if (!rp.ok || !rc.ok) {
        const j = (await rp.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? "Could not load post");
      }

      const pj = (await rp.json()) as { post: PostPayload };
      const cj = (await rc.json()) as { comments: CommentRow[] };
      setPost(pj.post);
      setComments(cj.comments ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load post");
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [rawId, validId, router]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!post || !editOpen) return;
    setEditTitle(post.title ?? "");
    setEditBody(post.body);
    const k = post.postKind;
    setEditKind(k === "question" || k === "tip" ? k : "post");
  }, [post, editOpen]);

  async function toggleLike() {
    if (!post) return;
    try {
      const res = await fetch(`/api/community/posts/${post.id}/like`, {
        method: "POST",
        credentials: "include",
      });
      const j = (await res.json().catch(() => ({}))) as {
        liked?: boolean;
        likeCount?: number;
        message?: string;
      };
      if (!res.ok) throw new Error(j.message ?? "Could not update like");
      setPost((prev) =>
        prev
          ? {
              ...prev,
              likedByMe: !!j.liked,
              likeCount: typeof j.likeCount === "number" ? j.likeCount : prev.likeCount,
            }
          : prev,
      );
      dispatchNotificationsUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update like");
    }
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    const t = reply.trim();
    if (!t || !post || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/community/posts/${post.id}/comments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: t }),
      });
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(j.message ?? "Could not send reply");
      setReply("");
      await loadAll();
      dispatchNotificationsUpdated();
      toast.success("Reply posted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reply");
    } finally {
      setSending(false);
    }
  }

  async function saveEdit() {
    if (!post || !editBody.trim()) {
      toast.error("Message cannot be empty.");
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/community/posts/${post.id}`, {
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
      setEditOpen(false);
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update post");
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmDelete() {
    if (!post) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/community/posts/${post.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(j.message ?? "Could not delete post");
      toast.success("Post deleted");
      setDeleteOpen(false);
      router.replace("/community");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete post");
    } finally {
      setDeleting(false);
    }
  }

  if (!validId) {
    return (
      <AppShell>
        <AppHeader title="Post" showBack showNotifications />
        <div className="px-4 pt-8 text-center text-sm text-muted-foreground">
          Invalid link.{" "}
          <Link href="/community" className="font-medium text-primary">
            Back to community
          </Link>
        </div>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell>
        <AppHeader title="Post" showBack showNotifications />
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (!post) {
    return (
      <AppShell>
        <AppHeader title="Post" showBack showNotifications />
        <div className="px-4 pt-8 text-center text-sm text-muted-foreground">
          This post may have been removed.{" "}
          <Link href="/community" className="font-medium text-primary">
            Back to community
          </Link>
        </div>
      </AppShell>
    );
  }

  const meta = [
    kindLabel(post.postKind),
    post.gestationalWeekSnapshot != null ? `Week ${post.gestationalWeekSnapshot}` : null,
    formatDistanceToNow(new Date(post.createdAt), { addSuffix: true }),
  ]
    .filter(Boolean)
    .join(" · ");

  const isOwner = user?.id === post.authorId;

  return (
    <AppShell>
      <AppHeader title="Post" showBack showNotifications />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
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
              <Label htmlFor="det-et">Title (optional)</Label>
              <Input
                id="det-et"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="det-eb">Message</Label>
              <Textarea
                id="det-eb"
                rows={6}
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                className="rounded-xl"
                required
              />
            </div>
            <DialogFooter className="gap-2 pt-2 sm:gap-0">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEditOpen(false)}>
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

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open && deleting) return;
          setDeleteOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes your post and its replies. This cannot be undone.
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

      <div
        className="space-y-4 px-4 pt-4"
        style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}
      >
        <Card className="relative p-4 shadow-soft">
          {isOwner ? (
            <div className="absolute right-2 top-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-full" aria-label="Post options">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-[100]">
                  <DropdownMenuItem onClick={() => setEditOpen(true)}>
                    <Pencil className="mr-2 h-4 w-4" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}
          <div className={cn("mb-2 flex items-center gap-2.5", isOwner && "pr-10")}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft font-display text-sm font-semibold text-primary">
              {avatarLetter(post.authorDisplayName)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-sm font-semibold">{post.authorDisplayName}</p>
                {verified(post.authorRole) && (
                  <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                    ✓ Verified
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">{meta}</p>
            </div>
          </div>
          {post.title ? <p className="mb-2 font-display text-base font-semibold">{post.title}</p> : null}
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{post.body}</p>
          <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
            <button
              type="button"
              className={`flex items-center gap-1.5 rounded-lg px-1 py-0.5 transition-colors hover:text-primary ${post.likedByMe ? "text-primary" : ""}`}
              onClick={() => void toggleLike()}
            >
              <Heart className={`h-4 w-4 ${post.likedByMe ? "fill-current" : ""}`} /> {post.likeCount}
            </button>
            <span className="flex items-center gap-1.5">
              <MessageCircle className="h-4 w-4" /> {post.commentCount}
            </span>
          </div>
        </Card>

        <h2 className="font-display text-sm font-semibold">Replies</h2>
        <div className="space-y-2.5">
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No replies yet — add a kind note below.</p>
          ) : (
            comments.map((c) => (
              <Card key={c.id} className="flex gap-2.5 p-3 shadow-soft">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-display text-xs font-semibold text-accent">
                  {avatarLetter(c.authorDisplayName)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-semibold">{c.authorDisplayName}</p>
                      {verified(c.authorRole) && (
                        <span className="rounded-full bg-accent/15 px-1 py-0 text-[9px] font-semibold text-accent">
                          ✓
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-foreground/90 whitespace-pre-wrap">{c.body}</p>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      <div
        className="fixed inset-x-0 z-30 mx-auto max-w-md border-t border-border/60 bg-background/95 px-3 pt-2 backdrop-blur-xl"
        style={{
          bottom: "calc(env(safe-area-inset-bottom) + 5rem)",
        }}
      >
        <form onSubmit={(e) => void sendReply(e)} className="flex items-center gap-2 rounded-2xl border border-border bg-card p-1.5">
          <input
            placeholder="Add a kind reply…"
            className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            disabled={sending}
          />
          <Button
            type="submit"
            size="icon"
            className="h-9 w-9 rounded-xl"
            aria-label="Send"
            disabled={!reply.trim() || sending}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
