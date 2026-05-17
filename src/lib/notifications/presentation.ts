import type { LucideIcon } from "lucide-react";
import { Bell, Heart, MessageCircle, Sparkles } from "lucide-react";

import type { NotificationDTO } from "@/lib/notifications/types";

export type NotificationPresentation = {
  headline: string;
  detail: string | null;
  actionLabel: string;
  ActionIcon: LucideIcon;
  actionClassName: string;
  badgeClassName: string;
};

export function getNotificationPresentation(n: NotificationDTO): NotificationPresentation {
  const name = n.actorDisplayName?.trim() || "Someone";

  switch (n.kind) {
    case "community_like":
      return {
        headline: name,
        detail: n.body ? `"${n.body}"` : "Liked your community post",
        actionLabel: "Like",
        ActionIcon: Heart,
        actionClassName: "text-rose-600",
        badgeClassName: "bg-rose-100 text-rose-600 ring-rose-200/80",
      };
    case "community_reply":
      return {
        headline: name,
        detail: n.body ?? "Replied on your community post",
        actionLabel: "Comment",
        ActionIcon: MessageCircle,
        actionClassName: "text-sky-600",
        badgeClassName: "bg-sky-100 text-sky-600 ring-sky-200/80",
      };
    case "reminder":
      return {
        headline: "MaaCare reminder",
        detail: n.body ?? n.title,
        actionLabel: "Reminder",
        ActionIcon: Sparkles,
        actionClassName: "text-amber-600",
        badgeClassName: "bg-amber-100 text-amber-700 ring-amber-200/80",
      };
    case "system":
    default:
      return {
        headline: n.title || "MaaCare",
        detail: n.body ?? (n.actorDisplayName ? `From ${name}` : null),
        actionLabel: "Update",
        ActionIcon: Bell,
        actionClassName: "text-primary",
        badgeClassName: "bg-primary-soft text-primary ring-primary/20",
      };
  }
}
