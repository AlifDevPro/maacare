import { isToday, isYesterday, startOfDay, subDays } from "date-fns";

export type ChatHistoryListItem = {
  id: string;
  title: string;
  lastMessagePreview: string | null;
  updatedAt: string;
  createdAt: string;
};

export type ChatHistoryDateGroup = "today" | "yesterday" | "previous7Days" | "older";

export type GroupedChatHistory = {
  group: ChatHistoryDateGroup;
  items: ChatHistoryListItem[];
};

export function filterChatHistory(
  items: ChatHistoryListItem[],
  query: string,
): ChatHistoryListItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const title = item.title.toLowerCase();
    const preview = (item.lastMessagePreview ?? "").toLowerCase();
    return title.includes(q) || preview.includes(q);
  });
}

function historyGroupForDate(date: Date): ChatHistoryDateGroup {
  if (isToday(date)) return "today";
  if (isYesterday(date)) return "yesterday";
  const weekAgo = startOfDay(subDays(new Date(), 7));
  if (date >= weekAgo) return "previous7Days";
  return "older";
}

export function groupChatHistoryByDate(items: ChatHistoryListItem[]): GroupedChatHistory[] {
  const buckets: Record<ChatHistoryDateGroup, ChatHistoryListItem[]> = {
    today: [],
    yesterday: [],
    previous7Days: [],
    older: [],
  };

  for (const item of items) {
    const updated = new Date(item.updatedAt);
    if (Number.isNaN(updated.getTime())) {
      buckets.older.push(item);
      continue;
    }
    buckets[historyGroupForDate(updated)].push(item);
  }

  const order: ChatHistoryDateGroup[] = ["today", "yesterday", "previous7Days", "older"];
  return order
    .map((group) => ({ group, items: buckets[group] }))
    .filter((g) => g.items.length > 0);
}
