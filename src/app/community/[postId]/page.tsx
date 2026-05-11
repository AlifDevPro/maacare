"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { formatDistanceToNow } from "date-fns";
import { CornerDownRight, Flag, Heart, Loader2, MessageCircle, MoreHorizontal, Pencil, Send, Trash2 } from "lucide-react";
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
  parentCommentId: string | null;
  authorId?: string;
  authorDisplayName: string;
  authorRole: string;
};

type CommentNode = CommentRow & { children: CommentNode[] };

function kindLabel(kind: string): string {
  if (kind === "question") return "Question";
  if (kind === "tip") return "Tip";
  return "Post";
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
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editKind, setEditKind] = useState<"post" | "question" | "tip">("post");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<
    "spam" | "abuse" | "harassment" | "misinformation" | "other"
  >("spam");
  const [reportDetails, setReportDetails] = useState("");
  const [reporting, setReporting] = useState(false);
  const [pendingLike, setPendingLike] = useState(false);

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
    const t = window.setTimeout(() => {
      void loadAll();
    }, 0);
    return () => window.clearTimeout(t);
  }, [loadAll]);

  async function toggleLike() {
    if (!post || pendingLike) return;
    const prevLiked = post.likedByMe;
    const prevCount = post.likeCount;
    const nextLiked = !prevLiked;
    setPendingLike(true);
    setPost((prev) =>
      prev
        ? { ...prev, likedByMe: nextLiked, likeCount: Math.max(0, prev.likeCount + (nextLiked ? 1 : -1)) }
        : prev,
    );
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
      setPost((prev) => (prev ? { ...prev, likedByMe: prevLiked, likeCount: prevCount } : prev));
      toast.error(e instanceof Error ? e.message : "Could not update like");
    } finally {
      setPendingLike(false);
    }
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    const t = reply.trim();
    if (!t || !post || sending) return;
    setSending(true);
    const optimisticId = `temp-${Date.now()}`;
    const optimisticComment: CommentRow = {
      id: optimisticId,
      body: t,
      createdAt: new Date().toISOString(),
      parentCommentId: replyToCommentId,
      authorId: user?.id,
      authorDisplayName: user?.name ?? "You",
      authorRole: user?.role ?? "user",
    };
    setComments((prev) => [...prev, optimisticComment]);
    setPost((prev) => (prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev));
    setReply("");
    setReplyToCommentId(null);
    try {
      const res = await fetch(`/api/community/posts/${post.id}/comments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: t, parentCommentId: replyToCommentId }),
      });
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(j.message ?? "Could not send reply");
      void loadAll();
      dispatchNotificationsUpdated();
      toast.success("Reply posted");
    } catch (err) {
      setComments((prev) => prev.filter((c) => c.id !== optimisticId));
      setPost((prev) => (prev ? { ...prev, commentCount: Math.max(0, prev.commentCount - 1) } : prev));
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

  async function submitReport() {
    if (!post) return;
    setReporting(true);
    try {
      const res = await fetch(`/api/community/posts/${post.id}/report`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reportReason, details: reportDetails.trim() || undefined }),
      });
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(j.message ?? "Could not submit report");
      toast.success("Report submitted. Admin will review it.");
      setReportOpen(false);
      setReportReason("spam");
      setReportDetails("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit report");
    } finally {
      setReporting(false);
    }
  }

  function openEditDialog() {
    if (!post) return;
    setEditTitle(post.title ?? "");
    setEditBody(post.body);
    const k = post.postKind;
    setEditKind(k === "question" || k === "tip" ? k : "post");
    setEditOpen(true);
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
  const commentById = new Map(comments.map((c) => [c.id, c]));
  const roots: CommentNode[] = [];
  const nodeById = new Map<string, CommentNode>();
  for (const c of comments) {
    nodeById.set(c.id, { ...c, children: [] });
  }
  for (const c of comments) {
    const node = nodeById.get(c.id)!;
    if (c.parentCommentId && nodeById.has(c.parentCommentId)) {
      nodeById.get(c.parentCommentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

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

      <Dialog open={reportOpen} onOpenChange={(o) => !reporting && setReportOpen(o)}>
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
              <Select value={reportReason} onValueChange={(v) => setReportReason(v as typeof reportReason)}>
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
              <Label htmlFor="post-report-details">Details (optional)</Label>
              <Textarea
                id="post-report-details"
                rows={4}
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Add context for admins..."
                className="rounded-xl"
              />
            </div>
            <DialogFooter className="gap-2 pt-2 sm:gap-0">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setReportOpen(false)} disabled={reporting}>
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl" disabled={reporting}>
                {reporting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</> : "Submit report"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
                  <DropdownMenuItem onClick={() => openEditDialog()}>
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
              </div>
              <p className="text-[11px] text-muted-foreground">{meta}</p>
            </div>
          </div>
          {post.title ? <p className="mb-2 font-display text-base font-semibold">{post.title}</p> : null}
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{post.body}</p>
          <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
            <button
              type="button"
              className={`flex items-center gap-1.5 rounded-lg px-1 py-0.5 transition-colors hover:text-primary disabled:opacity-60 ${post.likedByMe ? "text-primary" : ""}`}
              onClick={() => void toggleLike()}
              disabled={pendingLike}
            >
              <Heart className={`h-4 w-4 ${post.likedByMe ? "fill-current" : ""}`} /> {post.likeCount}
            </button>
            <span className="flex items-center gap-1.5">
              <MessageCircle className="h-4 w-4" /> {post.commentCount}
            </span>
            {!isOwner ? (
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-lg px-1 py-0.5 transition-colors hover:text-destructive"
                onClick={() => setReportOpen(true)}
              >
                <Flag className="h-4 w-4" /> Report
              </button>
            ) : null}
          </div>
        </Card>

        <h2 className="font-display text-sm font-semibold">Replies</h2>
        <div className="space-y-2">
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No replies yet — add a kind note below.</p>
          ) : (
            roots.map((node) => (
              <CommentTree
                key={node.id}
                node={node}
                depth={0}
                onReply={(id) => setReplyToCommentId(id)}
              />
            ))
          )}
        </div>
      </div>

      <div
        className="fixed inset-x-0 z-30 mx-auto max-w-md border-t border-border/60 bg-background/95 px-3 pt-2 backdrop-blur-xl"
        style={{
          bottom: "calc(env(safe-area-inset-bottom) + 5.75rem)",
        }}
      >
        {replyToCommentId ? (
          <div className="mb-2 flex items-center justify-between rounded-xl border border-border bg-muted/40 px-3 py-1.5 text-xs">
            <span className="truncate text-muted-foreground">
              Replying to {commentById.get(replyToCommentId)?.authorDisplayName ?? "comment"}
            </span>
            <button
              type="button"
              className="text-primary"
              onClick={() => setReplyToCommentId(null)}
            >
              Cancel
            </button>
          </div>
        ) : null}
        <form
          onSubmit={(e) => void sendReply(e)}
          className="flex items-center gap-2 rounded-2xl border border-border bg-card px-2 py-1.5"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft font-display text-xs font-semibold text-primary">
            {avatarLetter(user?.name ?? user?.email ?? "You")}
          </span>
          <input
            placeholder={replyToCommentId ? "Write a reply…" : "Add a kind comment…"}
            className="h-9 flex-1 rounded-full bg-muted px-3 text-sm outline-none placeholder:text-muted-foreground"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            disabled={sending}
          />
          <Button
            type="submit"
            size="icon"
            className="h-9 w-9 rounded-full"
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

function CommentTree({
  node,
  depth,
  onReply,
}: {
  node: CommentNode;
  depth: number;
  onReply: (id: string) => void;
}) {
  const safeDepth = Math.min(depth, 4);
  return (
    <div className={safeDepth > 0 ? "ml-5 border-l-2 border-border/80 pl-3" : ""}>
      <div className="flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-display text-xs font-semibold text-accent">
          {avatarLetter(node.authorDisplayName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="rounded-2xl bg-muted px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-sm font-semibold">{node.authorDisplayName}</p>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {formatDistanceToNow(new Date(node.createdAt), { addSuffix: true })}
              </span>
            </div>
            <p className="mt-0.5 text-sm whitespace-pre-wrap text-foreground/90">{node.body}</p>
          </div>
          <div className="mt-1 flex items-center gap-3 pl-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
              onClick={() => onReply(node.id)}
            >
              <CornerDownRight className="h-3.5 w-3.5" /> Reply
            </button>
          </div>
        </div>
      </div>

      {node.children.length ? (
        <div className="mt-1.5 space-y-1.5">
          {node.children.map((child) => (
            <CommentTree key={child.id} node={child} depth={safeDepth + 1} onReply={onReply} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
