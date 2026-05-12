-- Allow signed-in community viewers to read limited pregnancy summary when the member
-- has enabled "extended community profile". API still selects only week/EDD/status columns.

drop policy if exists "preg_select_community_extended_viewers" on public.pregnancy_profiles;

create policy "preg_select_community_extended_viewers"
  on public.pregnancy_profiles for select
  to authenticated
  using (
    auth.uid() is not null
    and exists (
      select 1
      from public.profiles pr
      where pr.id = pregnancy_profiles.user_id
        and pr.community_show_extended_profile is true
    )
  );
