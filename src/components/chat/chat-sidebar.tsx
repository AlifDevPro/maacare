"use client";

import { useMemo, useState } from "react";
import { MessageSquarePlus, Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ChatConversationList } from "@/components/chat/chat-conversation-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { filterChatHistory, type ChatHistoryListItem } from "@/lib/chat/history-ui";

type ChatSidebarProps = {
  items: ChatHistoryListItem[];
  loading: boolean;
  activeConversationId: string | null;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (item: ChatHistoryListItem) => void;
  onRenameConversation: (item: ChatHistoryListItem) => void;
};

export function ChatSidebar({
  items,
  loading,
  activeConversationId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
}: ChatSidebarProps) {
  const { t } = useTranslation("health");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = useMemo(
    () => filterChatHistory(items, searchQuery),
    [items, searchQuery],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-2 border-b border-border/60 px-3 py-3">
        <Button
          type="button"
          variant="outline"
          className="h-9 w-full justify-start gap-2 rounded-lg text-sm"
          onClick={onNewChat}
        >
          <MessageSquarePlus className="h-4 w-4" />
          {t("chat_new_chat")}
        </Button>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("chat_search_placeholder")}
            className="h-9 rounded-lg pl-8 text-sm"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pt-2">
        <ChatConversationList
          items={filteredItems}
          loading={loading}
          searchQuery={searchQuery}
          activeConversationId={activeConversationId}
          onSelectConversation={onSelectConversation}
          onDeleteConversation={onDeleteConversation}
          onRenameConversation={onRenameConversation}
        />
      </div>
    </div>
  );
}
