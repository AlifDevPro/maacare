-- Let signed-in users see basic identity for authors on visible community threads.
-- Without this, nested `profiles` on community_posts / community_comments is empty for other users.

drop policy if exists "profiles_select_community_participants" on public.profiles;

create policy "profiles_select_community_participants"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1
      from public.community_posts cp
      where cp.author_id = profiles.id
        and cp.moderation_status = 'visible'
    )
    or exists (
      select 1
      from public.community_comments cc
      inner join public.community_posts cp on cp.id = cc.post_id
      where cc.author_id = profiles.id
        and cc.moderation_status = 'visible'
        and cp.moderation_status = 'visible'
    )
  );
