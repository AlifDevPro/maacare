-- Stop auto-promoting the first signup to admin (admins are assigned explicitly).
-- After applying: promote at least one account:
--   update public.profiles set role = 'admin' where lower(email) = lower('your@email.com');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role, language)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'name'), ''),
      split_part(coalesce(new.email, 'user'), '@', 1)
    ),
    'user'::public.user_role,
    case
      when new.raw_user_meta_data->>'language' in ('en', 'bn')
      then new.raw_user_meta_data->>'language'
      else 'en'
    end
  );
  return new;
end;
$$;

drop policy if exists posts_delete_own on public.community_posts;

create policy posts_delete_own
  on public.community_posts for delete
  using (auth.uid() = author_id or public.is_admin(auth.uid()));
