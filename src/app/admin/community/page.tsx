"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { formatDistanceToNow } from "date-fns";
import { Eye, EyeOff, Flag, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ModerationStatus = "visible" | "hidden" | "pending";

type AdminPostRow = {
  id: string;
  title: string | null;
  body: string;
  postKind: string;
  moderationStatus: string;
  createdAt: string;
  authorId: string;
  authorDisplayName: string;
  authorEmail: string | null;
  isPinned: boolean;
};

function kindLabel(kind: string): string {
  if (kind === "question") return "Question";
  if (kind === "tip") return "Tip";
  return "Post";
}

export default function CommunityModeration() {
  const [posts, setPosts] = useState<AdminPostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<AdminPostRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [patchingId, setPatchingId] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/community/posts?limit=120", { credentials: "include" });
      const j = (await res.json().catch(() => ({}))) as { posts?: AdminPostRow[]; message?: string };
      if (res.status === 403) {
        toast.error("Admin access required.");
        setPosts([]);
        return;
      }
      if (!res.ok) throw new Error(j.message ?? "Could not load posts.");
      setPosts(j.posts ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load posts.");
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  async function setModeration(postId: string, moderationStatus: ModerationStatus) {
    setPatchingId(postId);
    try {
      const res = await fetch(`/api/admin/community/posts/${postId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moderationStatus }),
      });
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(j.message ?? "Could not update post.");
      toast.success(
        moderationStatus === "visible" ? "Post is visible" : moderationStatus === "hidden" ? "Post hidden" : "Marked pending",
      );
      await loadPosts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update post.");
    } finally {
      setPatchingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/community/posts/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(j.message ?? "Could not delete post.");
      toast.success("Post deleted");
      setDeleteTarget(null);
      await loadPosts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete post.");
    } finally {
      setDeleting(false);
    }
  }

  const queue = posts.filter((p) => p.moderationStatus === "pending");

  function PostAdminCard({ p }: { p: AdminPostRow }) {
    const busy = patchingId === p.id;
    const status = p.moderationStatus;

    return (
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{p.authorDisplayName}</span>
              {p.authorEmail ? (
                <span className="text-xs text-muted-foreground">{p.authorEmail}</span>
              ) : null}
              <Badge variant="outline" className="capitalize">
                {kindLabel(p.postKind)}
              </Badge>
              <Badge
                variant={status === "visible" ? "secondary" : status === "pending" ? "default" : "destructive"}
                className="capitalize"
              >
                {status}
              </Badge>
              {p.isPinned ? <Badge variant="outline">Pinned</Badge> : null}
            </div>
            {p.title ? <p className="font-display text-sm font-semibold">{p.title}</p> : null}
            <p className="line-clamp-4 text-sm text-foreground/90">{p.body}</p>
            <p className="text-[11px] text-muted-foreground">
              {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}
              {" · "}
              <Link href={`/community/${p.id}`} className="font-medium text-primary hover:underline">
                Open in app
              </Link>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy || status === "visible"}
              onClick={() => void setModeration(p.id, "visible")}
            >
              <Eye className="mr-1 h-3.5 w-3.5" /> Visible
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || status === "hidden"}
              onClick={() => void setModeration(p.id, "hidden")}
            >
              <EyeOff className="mr-1 h-3.5 w-3.5" /> Hide
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || status === "pending"}
              onClick={() => void setModeration(p.id, "pending")}
            >
              <Flag className="mr-1 h-3.5 w-3.5" /> Pending
            </Button>
            <Button size="sm" variant="destructive" disabled={busy} onClick={() => setDeleteTarget(p)}>
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Community moderation</h1>
        <p className="text-sm text-muted-foreground">
          Review pending posts, hide content, or remove posts. Data comes from your Supabase project.
        </p>
      </div>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && deleting) return;
          setDeleteTarget(open ? deleteTarget : null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the post and related data from the database. Use hide if you only want to remove it from the feed.
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

      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">
            Pending ({loading ? "…" : queue.length})
          </TabsTrigger>
          <TabsTrigger value="all">All posts</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-5 space-y-3">
          {loading ? (
            <Card className="flex justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </Card>
          ) : queue.length === 0 ? (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              No posts are awaiting moderation. Pending posts appear here when moderation status is set to pending.
            </Card>
          ) : (
            queue.map((p) => <PostAdminCard key={p.id} p={p} />)
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-5 space-y-3">
          {loading ? (
            <Card className="flex justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </Card>
          ) : posts.length === 0 ? (
            <Card className="p-10 text-center text-sm text-muted-foreground">No community posts yet.</Card>
          ) : (
            posts.map((p) => <PostAdminCard key={p.id} p={p} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
