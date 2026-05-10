-- Repair missing profiles (e.g. trigger failed, user added before migration, or confirm-email edge cases).

create or replace function public.ensure_profile_for_current_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n int;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from public.profiles where id = uid) then
    return;
  end if;

  select count(*) into n from public.profiles;

  insert into public.profiles (id, email, display_name, role, language)
  select
    u.id,
    u.email,
    coalesce(
      nullif(trim(u.raw_user_meta_data->>'display_name'), ''),
      nullif(trim(u.raw_user_meta_data->>'name'), ''),
      split_part(coalesce(u.email, 'user'), '@', 1)
    ),
    case when n = 0 then 'admin'::public.user_role else 'user'::public.user_role end,
    case
      when u.raw_user_meta_data->>'language' in ('en', 'bn')
      then u.raw_user_meta_data->>'language'
      else 'en'
    end
  from auth.users u
  where u.id = uid
  on conflict (id) do nothing;
end;
$$;

grant execute on function public.ensure_profile_for_current_user() to authenticated;
