import type { SupabaseClient } from "@supabase/supabase-js";

export const AI_CHAT_DEFAULT_TITLE = "New chat";
export const AI_CHAT_LIST_LIMIT = 50;

export type AiChatMessageRole = "user" | "assistant";

export type AiChatConversationRow = {
  id: string;
  user_id: string;
  title: string;
  last_message_preview: string | null;
  report_context: unknown | null;
  language_tag: string | null;
  created_at: string;
  updated_at: string;
};

export type AiChatMessageRow = {
  id: string;
  conversation_id: string;
  role: AiChatMessageRole;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AiChatConversationSummary = {
  id: string;
  title: string;
  lastMessagePreview: string | null;
  updatedAt: string;
  createdAt: string;
};

export type AiChatConversationDetail = AiChatConversationSummary & {
  reportContext: unknown | null;
  messages: Array<{
    id: string;
    role: AiChatMessageRole;
    content: string;
    createdAt: string;
    metadata: Record<string, unknown>;
  }>;
};

function toSummary(row: AiChatConversationRow): AiChatConversationSummary {
  return {
    id: row.id,
    title: row.title,
    lastMessagePreview: row.last_message_preview,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

export async function listAiChatConversations(
  supabase: SupabaseClient,
  userId: string,
  limit = AI_CHAT_LIST_LIMIT,
): Promise<AiChatConversationSummary[]> {
  const { data, error } = await supabase
    .from("ai_chat_conversations")
    .select("id, user_id, title, last_message_preview, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map((row) => toSummary(row as AiChatConversationRow));
}

export async function createAiChatConversation(
  supabase: SupabaseClient,
  userId: string,
  reportContext?: unknown,
): Promise<string> {
  const { data, error } = await supabase
    .from("ai_chat_conversations")
    .insert({
      user_id: userId,
      report_context: reportContext ?? null,
    })
    .select("id")
    .single();

  if (error || !data?.id) throw error ?? new Error("Could not create conversation.");
  return data.id as string;
}

export async function getAiChatConversationForUser(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
): Promise<AiChatConversationRow | null> {
  const { data, error } = await supabase
    .from("ai_chat_conversations")
    .select("id, user_id, title, last_message_preview, report_context, language_tag, created_at, updated_at")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data as AiChatConversationRow | null) ?? null;
}

export async function loadAiChatConversationDetail(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
): Promise<AiChatConversationDetail | null> {
  const conv = await getAiChatConversationForUser(supabase, userId, conversationId);
  if (!conv) return null;

  const { data: messages, error: mErr } = await supabase
    .from("ai_chat_messages")
    .select("id, conversation_id, role, content, metadata, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (mErr) throw mErr;

  return {
    ...toSummary(conv),
    reportContext: conv.report_context,
    messages: (messages ?? []).map((m) => ({
      id: m.id as string,
      role: m.role as AiChatMessageRole,
      content: m.content as string,
      createdAt: m.created_at as string,
      metadata: (m.metadata as Record<string, unknown>) ?? {},
    })),
  };
}

export async function updateAiChatConversationTitle(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  title: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("ai_chat_conversations")
    .update({ title })
    .eq("id", conversationId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return Boolean(data?.id);
}

export async function deleteAiChatConversation(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("ai_chat_conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return Boolean(data?.id);
}

export type PersistAiChatTurnInput = {
  userId: string;
  conversationId?: string;
  userContent: string;
  assistantContent: string;
  reportContext?: unknown;
  languageTag?: string | null;
  userMetadata?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export async function persistAiChatTurn(
  supabase: SupabaseClient,
  input: PersistAiChatTurnInput,
): Promise<string> {
  let conversationId = input.conversationId;

  if (conversationId) {
    const existing = await getAiChatConversationForUser(supabase, input.userId, conversationId);
    if (!existing) {
      conversationId = undefined;
    }
  }

  if (!conversationId) {
    conversationId = await createAiChatConversation(supabase, input.userId, input.reportContext);
  }

  const rows = [
    {
      conversation_id: conversationId,
      role: "user",
      content: input.userContent,
      metadata: input.userMetadata ?? {},
    },
    {
      conversation_id: conversationId,
      role: "assistant",
      content: input.assistantContent,
      metadata: input.metadata ?? {},
    },
  ];

  const { error } = await supabase.from("ai_chat_messages").insert(rows);
  if (error) throw error;

  if (input.languageTag?.trim()) {
    const { error: langErr } = await supabase
      .from("ai_chat_conversations")
      .update({ language_tag: input.languageTag.trim() })
      .eq("id", conversationId)
      .eq("user_id", input.userId);
    if (langErr) throw langErr;
  }

  return conversationId;
}
