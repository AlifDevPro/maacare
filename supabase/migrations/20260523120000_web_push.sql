-- Web Push subscriptions, delivery queue, and profile prefs.

alter table public.profiles
  add column if not exists notify_push_enabled boolean not null default true;

alter table public.profiles
  add column if not exists notify_dm_messages boolean not null default true;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_secret text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_key unique (endpoint)
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
create policy "push_subscriptions_select_own"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
create policy "push_subscriptions_insert_own"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_update_own" on public.push_subscriptions;
create policy "push_subscriptions_update_own"
  on public.push_subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
create policy "push_subscriptions_delete_own"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

create table if not exists public.push_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  channel text not null check (channel in ('community', 'dm', 'system')),
  title text not null,
  body text,
  link_path text,
  tag text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists push_queue_pending_idx
  on public.push_queue (created_at)
  where processed_at is null;

alter table public.push_queue enable row level security;
-- No client policies: queue is written by SECURITY DEFINER triggers and read by service role only.

create or replace function public.queue_push_for_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ch text;
begin
  if new.kind in ('community_reply', 'community_like') then
    ch := 'community';
  else
    ch := 'system';
  end if;

  begin
    insert into public.push_queue (user_id, channel, title, body, link_path, tag)
    values (
      new.user_id,
      ch,
      new.title,
      new.body,
      new.link_path,
      'notif-' || new.id::text
    );
  exception
    when others then
      raise warning 'queue_push_for_notification: %', sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists notifications_queue_push on public.notifications;
create trigger notifications_queue_push
  after insert on public.notifications
  for each row execute function public.queue_push_for_notification();

create or replace function public.queue_push_for_dm_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
  sender_name text;
  preview text;
begin
  select
    case
      when c.user_low = new.sender_id then c.user_high
      else c.user_low
    end
    into recipient
  from public.dm_conversations c
  where c.id = new.conversation_id;

  if recipient is null or recipient = new.sender_id then
    return new;
  end if;

  select coalesce(nullif(trim(p.display_name), ''), 'Someone')
    into sender_name
  from public.profiles p
  where p.id = new.sender_id;

  preview := left(trim(regexp_replace(new.body, '\s+', ' ', 'g')), 120);

  begin
    insert into public.push_queue (user_id, channel, title, body, link_path, tag)
    values (
      recipient,
      'dm',
      sender_name || ' sent a message',
      nullif(preview, ''),
      '/messages/' || new.conversation_id::text,
      'dm-' || new.conversation_id::text
    );
  exception
    when others then
      raise warning 'queue_push_for_dm_message: %', sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists dm_messages_queue_push on public.dm_messages;
create trigger dm_messages_queue_push
  after insert on public.dm_messages
  for each row execute function public.queue_push_for_dm_message();
