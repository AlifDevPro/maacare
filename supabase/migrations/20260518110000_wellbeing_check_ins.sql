-- Private wellbeing check-ins (e.g. postpartum mood).
create table if not exists public.wellbeing_check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  context text not null default 'postpartum'
    check (context in ('postpartum', 'general')),
  mood_key text not null,
  note text,
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists wellbeing_check_ins_user_time_idx
  on public.wellbeing_check_ins (user_id, logged_at desc);

alter table public.wellbeing_check_ins enable row level security;

create policy "wellbeing_check_ins_select_own"
  on public.wellbeing_check_ins for select
  using (auth.uid() = user_id);

create policy "wellbeing_check_ins_insert_own"
  on public.wellbeing_check_ins for insert
  with check (auth.uid() = user_id);

create policy "wellbeing_check_ins_delete_own"
  on public.wellbeing_check_ins for delete
  using (auth.uid() = user_id);
