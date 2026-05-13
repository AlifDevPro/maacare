-- Developer opt-in for public marketing team listing (still requires admin published=true).

alter table public.developer_team_profiles
  add column if not exists show_on_team_section boolean not null default true;

comment on column public.developer_team_profiles.show_on_team_section is
  'When true, developer allows inclusion on the public team section once published by an admin.';

drop policy if exists "developer_team_profiles_select_public_or_own" on public.developer_team_profiles;
create policy "developer_team_profiles_select_public_or_own"
  on public.developer_team_profiles for select
  to anon, authenticated
  using (
    user_id = auth.uid()
    or (published = true and show_on_team_section = true)
  );
