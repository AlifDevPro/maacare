-- In-app notifications + optional prefs on profiles.

alter table public.profiles
  add column if not exists notify_community_activity boolean not null default true;

alter table public.profiles
  add column if not exists notify_daily_reminders boolean not null default true;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null
    check (kind in ('community_reply', 'community_like', 'system', 'reminder')),
  title text not null,
  body text,
  link_path text,
  actor_id uuid references public.profiles (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No INSERT policy for authenticated: rows created via SECURITY DEFINER trigger only.

create or replace function public.notify_on_community_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_author uuid;
  author_prefs_ok boolean;
  preview text;
begin
  if new.moderation_status is distinct from 'visible' then
    return new;
  end if;

  select p.author_id, coalesce(pr.notify_community_activity, true)
    into post_author, author_prefs_ok
  from public.community_posts p
  left join public.profiles pr on pr.id = p.author_id
  where p.id = new.post_id
    and p.moderation_status = 'visible';

  if post_author is null then
    return new;
  end if;

  if post_author = new.author_id then
    return new;
  end if;

  if not author_prefs_ok then
    return new;
  end if;

  preview := left(trim(regexp_replace(new.body, '\s+', ' ', 'g')), 160);

  insert into public.notifications (user_id, kind, title, body, link_path, actor_id, metadata)
  values (
    post_author,
    'community_reply',
    'New reply on your post',
    nullif(preview, ''),
    '/community/' || new.post_id::text,
    new.author_id,
    jsonb_build_object('comment_id', new.id, 'post_id', new.post_id)
  );

  return new;
end;
$$;

drop trigger if exists community_comments_notify_author on public.community_comments;

create trigger community_comments_notify_author
  after insert on public.community_comments
  for each row execute function public.notify_on_community_comment();
