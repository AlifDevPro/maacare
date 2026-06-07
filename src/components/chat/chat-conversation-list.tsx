"use client";

import { Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  groupChatHistoryByDate,
  type ChatHistoryDateGroup,
  type ChatHistoryListItem,
} from "@/lib/chat/history-ui";
import { cn } from "@/lib/utils";

type ChatConversationListProps = {
  items: ChatHistoryListItem[];
  loading: boolean;
  searchQuery: string;
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (item: ChatHistoryListItem) => void;
  onRenameConversation: (item: ChatHistoryListItem) => void;
};

const GROUP_LABEL_KEYS: Record<ChatHistoryDateGroup, string> = {
  today: "chat_group_today",
  yesterday: "chat_group_yesterday",
  previous7Days: "chat_group_previous_7_days",
  older: "chat_group_older",
};

export function ChatConversationList({
  items,
  loading,
  searchQuery,
  activeConversationId,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
}: ChatConversationListProps) {
  const { t } = useTranslation("health");
  const groups = groupChatHistoryByDate(items);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="px-3 py-8 text-center text-sm text-muted-foreground">
        {searchQuery.trim() ? t("chat_no_search_results") : t("chat_no_history")}
      </p>
    );
  }

  return (
    <div className="space-y-4 px-2 pb-3">
      {groups.map(({ group, items: groupItems }) => (
        <div key={group}>
          <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t(GROUP_LABEL_KEYS[group])}
          </p>
          <ul className="space-y-0.5">
            {groupItems.map((item) => (
              <li key={item.id}>
                <div
                  className={cn(
                    "group flex items-center gap-0.5 rounded-lg transition-colors hover:bg-muted/60",
                    activeConversationId === item.id && "bg-primary/8 hover:bg-primary/10",
                  )}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate px-2.5 py-2 text-left text-sm text-foreground"
                    onClick={() => onSelectConversation(item.id)}
                  >
                    {item.title}
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0 rounded-md opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                        aria-label={t("chat_rename")}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => onRenameConversation(item)}>
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        {t("chat_rename")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => onDeleteConversation(item)}
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        {t("chat_delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
