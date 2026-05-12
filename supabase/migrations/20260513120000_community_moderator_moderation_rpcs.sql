-- Allow moderators/admins to hide or restore community posts and comments via security-definer RPCs
-- (RLS otherwise restricts updates to authors only.)

create or replace function public.community_set_post_moderation_status(p_post_id uuid, p_status text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if p_status is null or p_status not in ('visible', 'hidden', 'pending') then
    raise exception 'invalid status';
  end if;

  if not exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.role in ('moderator'::public.user_role, 'admin'::public.user_role)
  ) then
    raise exception 'forbidden';
  end if;

  update public.community_posts
  set moderation_status = p_status
  where id = p_post_id;

  return found;
end;
$$;

create or replace function public.community_set_comment_moderation_status(p_comment_id uuid, p_status text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if p_status is null or p_status not in ('visible', 'hidden', 'pending') then
    raise exception 'invalid status';
  end if;

  if not exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.role in ('moderator'::public.user_role, 'admin'::public.user_role)
  ) then
    raise exception 'forbidden';
  end if;

  update public.community_comments
  set moderation_status = p_status
  where id = p_comment_id;

  return found;
end;
$$;

grant execute on function public.community_set_post_moderation_status(uuid, text) to authenticated;
grant execute on function public.community_set_comment_moderation_status(uuid, text) to authenticated;
