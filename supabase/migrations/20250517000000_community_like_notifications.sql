-- Notify post author when someone likes their post (in-app notifications).

create or replace function public.notify_on_community_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_author uuid;
  author_prefs_ok boolean;
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

  insert into public.notifications (user_id, kind, title, body, link_path, actor_id, metadata)
  values (
    post_author,
    'community_like',
    'Someone liked your post',
    null,
    '/community/' || new.post_id::text,
    new.user_id,
    jsonb_build_object('post_id', new.post_id)
  );

  return new;
end;
$$;

drop trigger if exists community_post_likes_notify_author on public.community_post_likes;

create trigger community_post_likes_notify_author
  after insert on public.community_post_likes
  for each row execute function public.notify_on_community_like();
