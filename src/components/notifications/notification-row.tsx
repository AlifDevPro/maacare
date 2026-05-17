"use client";

import { formatDistanceToNow } from "date-fns";

import { CommunityAvatar } from "@/components/community/community-avatar";
import { getNotificationPresentation } from "@/lib/notifications/presentation";
import type { NotificationDTO } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";

type NotificationRowProps = {
  notification: NotificationDTO;
  onClick: () => void;
  className?: string;
  compact?: boolean;
};

/** Facebook-style notification row: profile photo + small action badge + readable copy. */
export function NotificationRow({
  notification: n,
  onClick,
  className,
  compact = false,
}: NotificationRowProps) {
  const unread = !n.readAt;
  const pres = getNotificationPresentation(n);
  const { ActionIcon } = pres;
  const showActorAvatar = Boolean(n.actorId || n.actorDisplayName);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex w-full touch-manipulation items-start gap-3 text-left transition-colors",
        compact ? "px-4 py-3" : "rounded-2xl border border-border/70 bg-card p-4 shadow-soft",
        unread && !compact && "border-primary/20 bg-primary-soft/20",
        unread && compact && "bg-primary-soft/35",
        !unread && compact && "hover:bg-muted/40",
        !unread && !compact && "hover:bg-muted/30",
        className,
      )}
    >
      {unread && compact ? (
        <span
          className="absolute left-1.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-primary"
          aria-hidden
        />
      ) : null}

      <div className="relative shrink-0">
        {showActorAvatar ? (
          <CommunityAvatar
            url={n.actorAvatarUrl}
            name={n.actorDisplayName ?? pres.headline}
            className={cn("rounded-full", compact ? "h-12 w-12" : "h-14 w-14")}
            fallbackClassName="bg-muted text-sm font-semibold text-muted-foreground"
          />
        ) : (
          <span
            className={cn(
              "flex items-center justify-center rounded-full bg-muted",
              compact ? "h-12 w-12" : "h-14 w-14",
            )}
          >
            <ActionIcon className={cn("h-6 w-6", pres.actionClassName)} aria-hidden />
          </span>
        )}
        {showActorAvatar ? (
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-background",
              pres.badgeClassName,
            )}
            title={pres.actionLabel}
          >
            <ActionIcon className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
          </span>
        ) : null}
      </div>

      <div className="min-w-0 flex-1 pt-0.5">
        <p className={cn("leading-snug text-foreground", compact ? "text-[15px]" : "text-base")}>
          <span className="font-semibold">{pres.headline}</span>
          {n.kind === "community_like" ? (
            <span className="font-normal text-foreground/90"> liked your post</span>
          ) : null}
          {n.kind === "community_reply" ? (
            <span className="font-normal text-foreground/90"> commented on your post</span>
          ) : null}
        </p>
        {pres.detail ? (
          <p
            className={cn(
              "mt-1 line-clamp-2 text-foreground/75",
              compact ? "text-sm leading-relaxed" : "text-[15px] leading-relaxed",
            )}
          >
            {pres.detail}
          </p>
        ) : null}
        <p className="mt-1.5 text-xs font-medium text-muted-foreground">
          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
        </p>
      </div>
    </button>
  );
}
