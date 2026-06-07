-- AI chat history: per-user conversations and messages with RLS.

create table if not exists public.ai_chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default 'New chat',
  last_message_preview text,
  report_context jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_chat_conversations_user_updated_idx
  on public.ai_chat_conversations (user_id, updated_at desc);

create trigger ai_chat_conversations_set_updated_at
  before update on public.ai_chat_conversations
  for each row execute function public.set_updated_at();

create table if not exists public.ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_chat_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) >= 1 and char_length(content) <= 12000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_chat_messages_conversation_created_idx
  on public.ai_chat_messages (conversation_id, created_at asc);

create or replace function public.ai_chat_messages_touch_conversation()
returns trigger
language plpgsql
as $$
declare
  conv_title text;
  preview text;
begin
  preview := left(regexp_replace(new.content, E'[\\n\\r]+', ' ', 'g'), 140);

  select title into conv_title
  from public.ai_chat_conversations
  where id = new.conversation_id;

  update public.ai_chat_conversations
  set
    updated_at = now(),
    last_message_preview = preview,
    title = case
      when new.role = 'user' and conv_title = 'New chat'
      then left(regexp_replace(new.content, E'[\\n\\r]+', ' ', 'g'), 80)
      else title
    end
  where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists ai_chat_messages_touch_conversation on public.ai_chat_messages;
create trigger ai_chat_messages_touch_conversation
  after insert on public.ai_chat_messages
  for each row execute function public.ai_chat_messages_touch_conversation();

alter table public.ai_chat_conversations enable row level security;
alter table public.ai_chat_messages enable row level security;

drop policy if exists "ai_chat_conversations_select_own" on public.ai_chat_conversations;
create policy "ai_chat_conversations_select_own"
  on public.ai_chat_conversations for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "ai_chat_conversations_insert_own" on public.ai_chat_conversations;
create policy "ai_chat_conversations_insert_own"
  on public.ai_chat_conversations for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "ai_chat_conversations_update_own" on public.ai_chat_conversations;
create policy "ai_chat_conversations_update_own"
  on public.ai_chat_conversations for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "ai_chat_conversations_delete_own" on public.ai_chat_conversations;
create policy "ai_chat_conversations_delete_own"
  on public.ai_chat_conversations for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "ai_chat_messages_select_own" on public.ai_chat_messages;
create policy "ai_chat_messages_select_own"
  on public.ai_chat_messages for select
  to authenticated
  using (
    exists (
      select 1
      from public.ai_chat_conversations c
      where c.id = ai_chat_messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "ai_chat_messages_insert_own" on public.ai_chat_messages;
create policy "ai_chat_messages_insert_own"
  on public.ai_chat_messages for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.ai_chat_conversations c
      where c.id = ai_chat_messages.conversation_id
        and c.user_id = auth.uid()
    )
  );
