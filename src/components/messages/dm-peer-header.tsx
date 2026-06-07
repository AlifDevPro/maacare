"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

import { CommunityAvatar } from "@/components/community/community-avatar";

type DmPeerHeaderProps = {
  peerUserId: string;
  displayName: string;
  avatarUrl: string | null;
};

export function DmPeerHeader({ peerUserId, displayName, avatarUrl }: DmPeerHeaderProps) {
  const { t } = useTranslation("messages");

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-border/60 bg-background/95 px-4 py-3">
      <CommunityAvatar
        url={avatarUrl}
        name={displayName}
        className="h-11 w-11 shrink-0"
        fallbackClassName="bg-primary-soft text-sm font-semibold"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
        <Link
          href={`/community/member/${peerUserId}`}
          className="text-xs text-primary hover:underline"
        >
          {t("thread_view_profile")}
        </Link>
      </div>
    </div>
  );
}
