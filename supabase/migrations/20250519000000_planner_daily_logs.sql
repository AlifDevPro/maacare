create table if not exists public.planner_daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_date date not null,
  water_glasses int not null default 0 check (water_glasses >= 0 and water_glasses <= 20),
  tasks jsonb not null default '{}'::jsonb,
  reminders jsonb not null default '{"water": true, "meals": true, "walk": false}'::jsonb,
  completed boolean not null default false,
  completion_percent int not null default 0 check (completion_percent >= 0 and completion_percent <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, plan_date)
);

create index if not exists planner_daily_logs_user_date_idx
  on public.planner_daily_logs (user_id, plan_date desc);

drop trigger if exists planner_daily_logs_updated_at on public.planner_daily_logs;
create trigger planner_daily_logs_updated_at
  before update on public.planner_daily_logs
  for each row execute function public.set_updated_at();

alter table public.planner_daily_logs enable row level security;

drop policy if exists planner_daily_logs_select_own on public.planner_daily_logs;
create policy planner_daily_logs_select_own
  on public.planner_daily_logs
  for select
  using (auth.uid() = user_id);

drop policy if exists planner_daily_logs_insert_own on public.planner_daily_logs;
create policy planner_daily_logs_insert_own
  on public.planner_daily_logs
  for insert
  with check (auth.uid() = user_id);

drop policy if exists planner_daily_logs_update_own on public.planner_daily_logs;
create policy planner_daily_logs_update_own
  on public.planner_daily_logs
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

