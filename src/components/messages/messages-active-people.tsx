"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

import { CommunityAvatar } from "@/components/community/community-avatar";
import { cn } from "@/lib/utils";

export type ActivePerson = {
  peerUserId: string;
  conversationId: string;
  displayName: string;
  avatarUrl: string | null;
  hasUnread: boolean;
};

type MessagesActivePeopleProps = {
  people: ActivePerson[];
  className?: string;
};

export function MessagesActivePeople({ people, className }: MessagesActivePeopleProps) {
  const { t } = useTranslation("messages");

  if (people.length === 0) return null;

  return (
    <div className={cn("px-4 pt-2", className)}>
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {t("inbox_active_section")}
      </p>
      <div className="flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {people.map((person) => (
          <Link
            key={person.peerUserId}
            href={`/messages/${person.conversationId}`}
            className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5"
          >
            <div className="relative">
              <CommunityAvatar
                url={person.avatarUrl}
                name={person.displayName}
                className="h-14 w-14"
                fallbackClassName="bg-primary-soft text-sm font-semibold"
              />
              {person.hasUnread ? (
                <span
                  className="absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-background bg-primary"
                  aria-hidden
                />
              ) : (
                <span
                  className="absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-background bg-emerald-500"
                  aria-hidden
                />
              )}
            </div>
            <span className="line-clamp-2 w-full text-center text-[11px] font-medium leading-tight text-foreground">
              {person.displayName}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
