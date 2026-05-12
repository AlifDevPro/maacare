-- Community profile visibility, verified clinician flag, admin audit note on ban context
alter table public.profiles
  add column if not exists community_show_extended_profile boolean not null default false;

alter table public.profiles
  add column if not exists verified_professional boolean not null default false;

alter table public.profiles
  add column if not exists admin_note text;

alter table public.profiles
  add column if not exists ban_reason text;

comment on column public.profiles.community_show_extended_profile is 'When true, other signed-in users may see limited pregnancy/week summary on community member profile.';
comment on column public.profiles.verified_professional is 'Admin-set: show verified doctor/clinician badge in community (use with profession clinician).';

-- In-app feedback / error reports for product improvement
create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('error', 'feedback', 'navigation')),
  message text not null,
  context jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new', 'triaged', 'resolved')),
  admin_notes text
);

create index if not exists app_feedback_created_idx on public.app_feedback (created_at desc);
create index if not exists app_feedback_status_idx on public.app_feedback (status);

alter table public.app_feedback enable row level security;

drop policy if exists "app_feedback_insert_own" on public.app_feedback;
create policy "app_feedback_insert_own"
  on public.app_feedback for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "app_feedback_admin_select" on public.app_feedback;
create policy "app_feedback_admin_select"
  on public.app_feedback for select
  to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists "app_feedback_admin_update" on public.app_feedback;
create policy "app_feedback_admin_update"
  on public.app_feedback for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
