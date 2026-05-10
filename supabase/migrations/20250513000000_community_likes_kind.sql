-- Community: post kinds (tabs), optional week snapshot at post time, likes + tighter comment visibility

alter table public.community_posts
  add column if not exists post_kind text not null default 'post';

alter table public.community_posts
  drop constraint if exists community_posts_post_kind_check;

alter table public.community_posts
  add constraint community_posts_post_kind_check
  check (post_kind in ('post', 'question', 'tip'));

alter table public.community_posts
  add column if not exists gestational_week_snapshot smallint;

create table if not exists public.community_post_likes (
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists community_post_likes_post_idx on public.community_post_likes (post_id);

alter table public.community_post_likes enable row level security;

drop policy if exists "likes_select" on public.community_post_likes;
drop policy if exists "likes_insert_own" on public.community_post_likes;
drop policy if exists "likes_delete_own" on public.community_post_likes;

create policy "likes_select"
  on public.community_post_likes for select
  using (
    exists (
      select 1 from public.community_posts p
      where p.id = community_post_likes.post_id
        and (
          p.moderation_status = 'visible'
          or auth.uid() = p.author_id
          or public.is_admin(auth.uid())
        )
    )
  );

create policy "likes_insert_own"
  on public.community_post_likes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.community_posts p
      where p.id = community_post_likes.post_id
        and p.moderation_status = 'visible'
    )
  );

create policy "likes_delete_own"
  on public.community_post_likes for delete
  using (auth.uid() = user_id);

drop policy if exists "comments_read" on public.community_comments;

create policy "comments_read"
  on public.community_comments for select
  using (
    (
      moderation_status = 'visible'
      or auth.uid() = author_id
      or public.is_admin(auth.uid())
    )
    and exists (
      select 1 from public.community_posts p
      where p.id = community_comments.post_id
        and (
          p.moderation_status = 'visible'
          or auth.uid() = p.author_id
          or public.is_admin(auth.uid())
        )
    )
  );
