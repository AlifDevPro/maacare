-- Persist AI meal suggestions so we can diversify prompts across days.
create table if not exists public.planner_food_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_date date not null,
  meals jsonb not null,
  source text not null default 'food-rag',
  created_at timestamptz not null default now(),
  unique (user_id, plan_date)
);

create index if not exists planner_food_suggestions_user_date_idx
  on public.planner_food_suggestions (user_id, plan_date desc);

alter table public.planner_food_suggestions enable row level security;

drop policy if exists "planner_food_suggestions_select_own" on public.planner_food_suggestions;
create policy "planner_food_suggestions_select_own"
  on public.planner_food_suggestions for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "planner_food_suggestions_insert_own" on public.planner_food_suggestions;
create policy "planner_food_suggestions_insert_own"
  on public.planner_food_suggestions for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "planner_food_suggestions_update_own" on public.planner_food_suggestions;
create policy "planner_food_suggestions_update_own"
  on public.planner_food_suggestions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "planner_food_suggestions_delete_own" on public.planner_food_suggestions;
create policy "planner_food_suggestions_delete_own"
  on public.planner_food_suggestions for delete
  to authenticated
  using (user_id = auth.uid());

comment on table public.planner_food_suggestions is 'Daily planner meal suggestions (JSON array) for anti-repeat prompting.';
