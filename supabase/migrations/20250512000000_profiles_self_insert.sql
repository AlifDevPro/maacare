-- Let signed-in users create their own profile row (repair when trigger/RPC is unavailable).

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);
