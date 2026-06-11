-- Subscription plans, usage counters, and monthly reset tracking per user.

create table if not exists public.user_subscriptions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'premium')),
  subscription_status text not null default 'inactive'
    check (subscription_status in ('active', 'inactive', 'expired', 'canceled')),
  subscription_start_date timestamptz,
  subscription_end_date timestamptz,
  report_simplification_used_this_month integer not null default 0 check (report_simplification_used_this_month >= 0),
  symptom_analysis_used_this_month integer not null default 0 check (symptom_analysis_used_this_month >= 0),
  usage_reset_at timestamptz not null default (date_trunc('month', now() at time zone 'utc')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_subscriptions_plan_idx on public.user_subscriptions (plan);
create index if not exists user_subscriptions_status_idx on public.user_subscriptions (subscription_status);

drop trigger if exists user_subscriptions_updated_at on public.user_subscriptions;
create trigger user_subscriptions_updated_at
  before update on public.user_subscriptions
  for each row execute function public.set_updated_at();

alter table public.user_subscriptions enable row level security;

drop policy if exists "user_subscriptions_select_own" on public.user_subscriptions;
create policy "user_subscriptions_select_own"
  on public.user_subscriptions for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_subscriptions_insert_own" on public.user_subscriptions;
create policy "user_subscriptions_insert_own"
  on public.user_subscriptions for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "user_subscriptions_update_own" on public.user_subscriptions;
create policy "user_subscriptions_update_own"
  on public.user_subscriptions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

comment on table public.user_subscriptions is 'Per-user subscription plan, status, and monthly feature usage counters.';
