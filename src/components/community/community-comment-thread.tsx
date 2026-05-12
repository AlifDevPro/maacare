"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { CornerDownRight, Shield, Stethoscope } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { CommunityAvatar } from "@/components/community/community-avatar";
import {
  COMMUNITY_COMMENT_ACTION,
  COMMUNITY_COMMENT_ACTION_ICON,
} from "@/lib/community/action-row-styles";
import { cn } from "@/lib/utils";

export type CommunityCommentRow = {
  id: string;
  body: string;
  createdAt: string;
  parentCommentId: string | null;
  authorId?: string;
  authorDisplayName: string;
  authorRole: string;
  authorAvatarUrl?: string | null;
  authorProfession?: string | null;
  authorVerifiedProfessional?: boolean;
};

export type CommunityCommentNode = CommunityCommentRow & { children: CommunityCommentNode[] };

type CommentBranchProps = {
  node: CommunityCommentNode;
  depth: number;
  postId: string;
  isModerator: boolean;
  onReply: (id: string) => void;
  onModerated: () => void | Promise<void>;
};

function CommentBranch({ node, depth, postId, isModerator, onReply, onModerated }: CommentBranchProps) {
  const safeDepth = Math.min(depth, 8);
  const verifiedDoctor = node.authorVerifiedProfessional && node.authorProfession === "clinician";
  const hasChildren = node.children.length > 0;

  async function hideComment() {
    try {
      const res = await fetch(`/api/community/posts/${postId}/comments/${node.id}/moderate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "hidden" }),
      });
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(j.message ?? "Could not hide reply");
      toast.success("Reply hidden.");
      await onModerated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not hide reply");
    }
  }

  return (
    <div className="min-w-0">
      <div className="flex gap-3 py-2 sm:gap-3.5">
        <div className="shrink-0 pt-0.5">
          <CommunityAvatar
            url={node.authorAvatarUrl}
            name={node.authorDisplayName}
            className={cn(safeDepth === 0 ? "h-10 w-10 sm:h-11 sm:w-11" : "h-9 w-9")}
            fallbackClassName="bg-muted text-xs font-semibold text-muted-foreground"
          />
        </div>
        <div className="min-w-0 flex-1 border-b border-border/45 pb-3">
          <div
            className={cn(
              "rounded-xl px-0 py-0",
              verifiedDoctor && "border border-sky-500/35 bg-sky-500/[0.06] px-2.5 py-2 sm:px-3",
            )}
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              {node.authorId ? (
                <Link
                  href={`/community/member/${node.authorId}`}
                  className="truncate text-[15px] font-bold leading-tight text-foreground hover:underline sm:text-base"
                >
                  {node.authorDisplayName}
                </Link>
              ) : (
                <span className="truncate text-[15px] font-bold leading-tight sm:text-base">{node.authorDisplayName}</span>
              )}
              <span className="text-[13px] text-muted-foreground tabular-nums sm:text-sm">
                · {formatDistanceToNow(new Date(node.createdAt), { addSuffix: true })}
              </span>
              {node.authorRole === "admin" ? (
                <Badge
                  variant="outline"
                  className="h-5 gap-0.5 border-amber-500/50 bg-amber-500/10 px-1.5 text-[10px] font-semibold uppercase text-amber-900 dark:text-amber-100"
                >
                  <Shield className="h-3 w-3" />
                  Admin
                </Badge>
              ) : null}
              {node.authorRole === "moderator" ? (
                <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-semibold uppercase">
                  Mod
                </Badge>
              ) : null}
              {verifiedDoctor ? (
                <Badge
                  variant="outline"
                  className="h-5 gap-0.5 border-sky-500/50 bg-sky-500/10 px-1.5 text-[10px] font-semibold uppercase text-sky-900 dark:text-sky-100"
                >
                  <Stethoscope className="h-3 w-3" />
                  Verified
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/95 sm:text-base">
              {node.body}
            </p>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <button
              type="button"
              className={cn(COMMUNITY_COMMENT_ACTION, "text-muted-foreground hover:text-primary")}
              onClick={() => onReply(node.id)}
            >
              <CornerDownRight className={cn("h-4 w-4", COMMUNITY_COMMENT_ACTION_ICON)} />
              Reply
            </button>
            {isModerator ? (
              <button
                type="button"
                className={cn(COMMUNITY_COMMENT_ACTION, "text-muted-foreground hover:text-destructive")}
                onClick={() => void hideComment()}
              >
                Hide
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {hasChildren ? (
        <div className="ml-[22px] border-l border-border/60 pl-3 sm:ml-[26px] sm:pl-4">
          <div className="space-y-0">
            {node.children.map((child) => (
              <CommentBranch
                key={child.id}
                node={child}
                depth={safeDepth + 1}
                postId={postId}
                isModerator={isModerator}
                onReply={onReply}
                onModerated={onModerated}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function CommunityCommentThread({
  roots,
  postId,
  isModerator,
  onReply,
  onModerated,
}: {
  roots: CommunityCommentNode[];
  postId: string;
  isModerator: boolean;
  onReply: (id: string) => void;
  onModerated: () => void | Promise<void>;
}) {
  return (
    <div className="divide-y divide-border/35">
      {roots.map((node) => (
        <CommentBranch
          key={node.id}
          node={node}
          depth={0}
          postId={postId}
          isModerator={isModerator}
          onReply={onReply}
          onModerated={onModerated}
        />
      ))}
    </div>
  );
}
