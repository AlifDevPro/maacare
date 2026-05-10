create table if not exists public.community_post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('spam', 'abuse', 'harassment', 'misinformation', 'other')),
  details text,
  status text not null default 'open' check (status in ('open', 'resolved', 'rejected')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_post_reports_post_idx
  on public.community_post_reports (post_id, created_at desc);

create index if not exists community_post_reports_status_idx
  on public.community_post_reports (status, created_at desc);

create unique index if not exists community_post_reports_open_unique
  on public.community_post_reports (post_id, reporter_id)
  where status = 'open';

drop trigger if exists community_post_reports_updated_at on public.community_post_reports;
create trigger community_post_reports_updated_at
  before update on public.community_post_reports
  for each row execute function public.set_updated_at();

alter table public.community_post_reports enable row level security;

drop policy if exists community_reports_insert_own on public.community_post_reports;
create policy community_reports_insert_own
  on public.community_post_reports for insert
  with check (auth.uid() = reporter_id);

drop policy if exists community_reports_select_own_or_admin on public.community_post_reports;
create policy community_reports_select_own_or_admin
  on public.community_post_reports for select
  using (auth.uid() = reporter_id or public.is_admin(auth.uid()));

drop policy if exists community_reports_admin_update on public.community_post_reports;
create policy community_reports_admin_update
  on public.community_post_reports for update
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

