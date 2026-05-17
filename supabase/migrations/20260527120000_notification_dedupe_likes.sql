-- One in-app notification per (post author, liker, post) — re-likes refresh the same row.

create or replace function public.notify_on_community_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_author uuid;
  author_prefs_ok boolean;
  actor_name text;
  updated_count integer;
begin
  select p.author_id, coalesce(pr.notify_community_activity, true)
    into post_author, author_prefs_ok
  from public.community_posts p
  left join public.profiles pr on pr.id = p.author_id
  where p.id = new.post_id
    and p.moderation_status = 'visible';

  if post_author is null then
    return new;
  end if;

  if post_author = new.user_id then
    return new;
  end if;

  if not author_prefs_ok then
    return new;
  end if;

  select coalesce(nullif(trim(p.display_name), ''), 'Someone')
    into actor_name
  from public.profiles p
  where p.id = new.user_id;

  update public.notifications
  set
    created_at = now(),
    read_at = null,
    title = actor_name || ' liked your post',
    body = null,
    link_path = '/community/' || new.post_id::text
  where user_id = post_author
    and kind = 'community_like'
    and actor_id = new.user_id
    and metadata @> jsonb_build_object('post_id', new.post_id);

  get diagnostics updated_count = row_count;

  if updated_count = 0 then
    insert into public.notifications (user_id, kind, title, body, link_path, actor_id, metadata)
    values (
      post_author,
      'community_like',
      actor_name || ' liked your post',
      null,
      '/community/' || new.post_id::text,
      new.user_id,
      jsonb_build_object('post_id', new.post_id)
    );
  end if;

  return new;
end;
$$;

create or replace function public.notify_on_community_unlike()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.notifications
  where kind = 'community_like'
    and actor_id = old.user_id
    and metadata @> jsonb_build_object('post_id', old.post_id);

  return old;
end;
$$;

drop trigger if exists community_post_likes_notify_unlike on public.community_post_likes;

create trigger community_post_likes_notify_unlike
  after delete on public.community_post_likes
  for each row execute function public.notify_on_community_unlike();

-- Speed up dedupe lookups (optional; safe if index already exists).
create index if not exists notifications_community_like_dedup_idx
  on public.notifications (user_id, actor_id, kind)
  where kind = 'community_like';
