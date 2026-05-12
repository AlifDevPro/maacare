-- Direct messages (1:1): conversations, participants (read state), messages + Realtime.

create table if not exists public.dm_conversations (
  id uuid primary key default gen_random_uuid(),
  user_low uuid not null references public.profiles (id) on delete cascade,
  user_high uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dm_conversations_distinct_users check (user_low <> user_high),
  constraint dm_conversations_ordered_uuids check (user_low::text < user_high::text),
  constraint dm_conversations_pair_unique unique (user_low, user_high)
);

create index if not exists dm_conversations_user_low_idx on public.dm_conversations (user_low, updated_at desc);
create index if not exists dm_conversations_user_high_idx on public.dm_conversations (user_high, updated_at desc);

create trigger dm_conversations_set_updated_at
  before update on public.dm_conversations
  for each row execute function public.set_updated_at();

create table if not exists public.dm_participants (
  conversation_id uuid not null references public.dm_conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists dm_participants_user_idx on public.dm_participants (user_id, conversation_id);

create table if not exists public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.dm_conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) >= 1 and char_length(body) <= 8000),
  created_at timestamptz not null default now()
);

create index if not exists dm_messages_conversation_created_idx
  on public.dm_messages (conversation_id, created_at desc);

create or replace function public.dm_messages_touch_conversation()
returns trigger
language plpgsql
as $$
begin
  update public.dm_conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists dm_messages_touch_conversation on public.dm_messages;
create trigger dm_messages_touch_conversation
  after insert on public.dm_messages
  for each row execute function public.dm_messages_touch_conversation();

create or replace function public.dm_start_or_get_conversation(p_peer uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  lo uuid;
  hi uuid;
  cid uuid;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;
  if p_peer is null or p_peer = me then
    raise exception 'invalid peer';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_peer) then
    raise exception 'peer not found';
  end if;

  if me::text < p_peer::text then
    lo := me;
    hi := p_peer;
  else
    lo := p_peer;
    hi := me;
  end if;

  select c.id into cid
  from public.dm_conversations c
  where c.user_low = lo and c.user_high = hi;

  if cid is not null then
    insert into public.dm_participants (conversation_id, user_id)
    values (cid, lo), (cid, hi)
    on conflict do nothing;
    return cid;
  end if;

  insert into public.dm_conversations (user_low, user_high)
  values (lo, hi)
  returning id into cid;

  insert into public.dm_participants (conversation_id, user_id)
  values (cid, lo), (cid, hi);

  return cid;
end;
$$;

revoke all on function public.dm_start_or_get_conversation(uuid) from public;
grant execute on function public.dm_start_or_get_conversation(uuid) to authenticated;

alter table public.dm_conversations enable row level security;
alter table public.dm_participants enable row level security;
alter table public.dm_messages enable row level security;

drop policy if exists "dm_conversations_select_participant" on public.dm_conversations;
create policy "dm_conversations_select_participant"
  on public.dm_conversations for select
  to authenticated
  using (auth.uid() = user_low or auth.uid() = user_high);

drop policy if exists "dm_participants_select_self" on public.dm_participants;
create policy "dm_participants_select_self"
  on public.dm_participants for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "dm_participants_update_self" on public.dm_participants;
create policy "dm_participants_update_self"
  on public.dm_participants for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "dm_messages_select_participant" on public.dm_messages;
create policy "dm_messages_select_participant"
  on public.dm_messages for select
  to authenticated
  using (
    exists (
      select 1
      from public.dm_conversations c
      where c.id = dm_messages.conversation_id
        and (c.user_low = auth.uid() or c.user_high = auth.uid())
    )
  );

drop policy if exists "dm_messages_insert_sender_participant" on public.dm_messages;
create policy "dm_messages_insert_sender_participant"
  on public.dm_messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.dm_conversations c
      where c.id = dm_messages.conversation_id
        and (c.user_low = auth.uid() or c.user_high = auth.uid())
    )
  );

DO $body$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'dm_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_messages;
  END IF;
END
$body$;
