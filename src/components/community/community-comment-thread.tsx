"use client";

import { useCallback, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { CornerDownRight } from "lucide-react";
import { toast } from "sonner";

import { CommunityAvatar } from "@/components/community/community-avatar";
import { CommunityAuthorBadges } from "@/components/community/community-author-badges";
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
  expandedThreadIds: ReadonlySet<string>;
  onToggleThread: (id: string) => void;
  /** Index among siblings (for connector); roots omit. */
  siblingIndex?: number;
  siblingCount?: number;
  parentAuthorName?: string;
  parentBodyPreview?: string;
};

/** Vertical continuation rails (Facebook-style stacked thread). */
function CommentDepthRails({ depth }: { depth: number }) {
  if (depth <= 1) return null;
  return (
    <div className="flex shrink-0" aria-hidden>
      {Array.from({ length: depth - 1 }).map((_, i) => (
        <svg
          key={i}
          className="w-2.5 shrink-0 self-stretch text-muted-foreground/38 sm:w-3"
          viewBox="0 0 12 100"
          preserveAspectRatio="none"
        >
          <path
            d="M 6 0 L 6 100"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ))}
    </div>
  );
}

/** Elbow + stub to avatar for this reply row. */
function CommentThreadElbow({ isLastSibling }: { isLastSibling: boolean }) {
  return (
    <svg
      className="w-5 shrink-0 self-stretch text-muted-foreground/45 sm:w-6"
      viewBox="0 0 20 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      {isLastSibling ? (
        <path
          d="M 10 0 L 10 46 Q 10 56 14 56 L 20 56"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.65"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <>
          <path
            d="M 10 0 L 10 100"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.65"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
          />
          <path
            d="M 10 50 L 20 50"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.65"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

function CommentBranch({
  node,
  depth,
  postId,
  isModerator,
  onReply,
  onModerated,
  expandedThreadIds,
  onToggleThread,
  siblingIndex = 0,
  siblingCount = 1,
  parentAuthorName,
  parentBodyPreview,
}: CommentBranchProps) {
  const safeDepth = Math.min(depth, 8);
  const hasChildren = node.children.length > 0;
  const replyCount = node.children.length;
  const threadOpen = expandedThreadIds.has(node.id);

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
      await onModerated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not hide reply");
    }
  }

  const isLastSibling = siblingIndex >= siblingCount - 1;

  return (
    <div className={cn("min-w-0", safeDepth > 0 && "pl-2 sm:pl-3")}>
      <div className={cn("flex gap-1.5 sm:gap-2", safeDepth > 0 ? "py-1.5" : "py-2 sm:py-2")}>
        {safeDepth > 0 ? (
          <>
            <CommentDepthRails depth={safeDepth} />
            <CommentThreadElbow isLastSibling={isLastSibling} />
          </>
        ) : null}
        <div className={cn("flex shrink-0 gap-2.5 sm:gap-3", safeDepth > 0 ? "min-w-0 flex-1" : "w-full min-w-0")}>
          <div className={cn("shrink-0", safeDepth > 0 ? "pt-0" : "pt-0.5")}>
            <CommunityAvatar
              url={node.authorAvatarUrl}
              name={node.authorDisplayName}
              className={cn(
                safeDepth === 0 ? "h-10 w-10 sm:h-11 sm:w-11" : safeDepth === 1 ? "h-8 w-8" : "h-7 w-7",
              )}
              fallbackClassName="bg-muted text-[10px] font-semibold text-muted-foreground sm:text-xs"
            />
          </div>
          <div
            className={cn(
              "min-w-0 flex-1 border-b border-border/45",
              safeDepth > 0 ? "rounded-lg bg-muted/20 px-2.5 py-2" : "pb-3",
            )}
          >
            {safeDepth > 0 && parentAuthorName ? (
              <p className="mb-1.5 truncate text-[11px] font-medium text-muted-foreground">
                Replying to <span className="text-foreground/85">{parentAuthorName}</span>
                {parentBodyPreview ? (
                  <span className="ml-1.5 text-muted-foreground/85">• {parentBodyPreview}</span>
                ) : null}
              </p>
            ) : null}
            <div>
              <CommunityAuthorBadges
                authorId={node.authorId}
                authorDisplayName={node.authorDisplayName}
                authorRole={node.authorRole}
                authorProfession={node.authorProfession}
                authorVerifiedProfessional={node.authorVerifiedProfessional}
                timeLabel={formatDistanceToNow(new Date(node.createdAt), { addSuffix: true })}
              />
            <p className={cn("mt-1 whitespace-pre-wrap leading-relaxed text-foreground/95", safeDepth > 0 ? "text-sm" : "text-[15px] sm:text-base")}>
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
      </div>

      {hasChildren ? (
        <div className="mt-1">
          {!threadOpen ? (
            <button
              type="button"
              className="rounded-lg px-1 py-1 text-left text-[13px] font-semibold text-primary hover:bg-primary/10"
              onClick={() => onToggleThread(node.id)}
            >
              View {replyCount} {replyCount === 1 ? "reply" : "replies"}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="mb-1 rounded-lg px-1 py-1 text-left text-[13px] font-semibold text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                onClick={() => onToggleThread(node.id)}
              >
                Hide replies
              </button>
              <div className="space-y-0.5 pl-2 sm:pl-3">
                <div className="space-y-0 border-l border-border/45 pl-2.5 sm:pl-3">
                  {node.children.map((child, idx) => (
                    <CommentBranch
                      key={child.id}
                      node={child}
                      depth={safeDepth + 1}
                      postId={postId}
                      isModerator={isModerator}
                      onReply={onReply}
                      onModerated={onModerated}
                      expandedThreadIds={expandedThreadIds}
                      onToggleThread={onToggleThread}
                      siblingIndex={idx}
                      siblingCount={node.children.length}
                      parentAuthorName={node.authorDisplayName}
                      parentBodyPreview={node.body.trim().slice(0, 64)}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
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
  const [expandedThreadIds, setExpandedThreadIds] = useState<Set<string>>(() => new Set());

  const onToggleThread = useCallback((id: string) => {
    setExpandedThreadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div className="divide-y divide-border/35">
      {roots.map((node, idx) => (
        <CommentBranch
          key={node.id}
          node={node}
          depth={0}
          postId={postId}
          isModerator={isModerator}
          onReply={onReply}
          onModerated={onModerated}
          expandedThreadIds={expandedThreadIds}
          onToggleThread={onToggleThread}
          siblingIndex={idx}
          siblingCount={roots.length}
        />
      ))}
    </div>
  );
}
