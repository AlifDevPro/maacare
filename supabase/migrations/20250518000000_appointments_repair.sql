-- Ensure appointments table + policies exist for app scheduling flows.

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  scheduled_at timestamptz not null,
  provider_name text,
  location text,
  appointment_type text,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  notes text,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists appointments_user_time_idx on public.appointments (user_id, scheduled_at);

drop trigger if exists appointments_updated_at on public.appointments;
create trigger appointments_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

alter table public.appointments enable row level security;

drop policy if exists "appt_own_select" on public.appointments;
drop policy if exists "appt_own_mutate" on public.appointments;

create policy "appt_own_select" on public.appointments
  for select
  using (auth.uid() = user_id);

create policy "appt_own_mutate" on public.appointments
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

