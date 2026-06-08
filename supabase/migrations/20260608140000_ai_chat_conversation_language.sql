-- Persist active reply language per AI chat conversation for stable multilingual turns.

alter table public.ai_chat_conversations
  add column if not exists language_tag text;

comment on column public.ai_chat_conversations.language_tag is
  'BCP-47 language tag locked for assistant replies in this conversation (e.g. en, bn).';
