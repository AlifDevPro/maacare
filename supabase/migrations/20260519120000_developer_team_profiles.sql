-- Public team directory for landing page; optional 1:1 extension per profile.
-- Mutations are intended via Next.js API routes (service role); RLS allows public read of published rows.

create table if not exists public.developer_team_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  card_display_name text,
  job_title text not null default '',
  bio text not null default '',
  photo_url text,
  social_github text,
  social_twitter text,
  social_linkedin text,
  social_website text,
  sort_order int not null default 100,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists developer_team_profiles_published_sort_idx
  on public.developer_team_profiles (published, sort_order, user_id);

drop trigger if exists developer_team_profiles_updated_at on public.developer_team_profiles;
create trigger developer_team_profiles_updated_at
  before update on public.developer_team_profiles
  for each row execute function public.set_updated_at();

alter table public.developer_team_profiles enable row level security;

drop policy if exists "developer_team_profiles_select_public_or_own" on public.developer_team_profiles;
create policy "developer_team_profiles_select_public_or_own"
  on public.developer_team_profiles for select
  to anon, authenticated
  using (published = true or user_id = auth.uid());

comment on table public.developer_team_profiles is 'Team cards for marketing site; admins control publish/sort via API (service role).';

grant select on table public.developer_team_profiles to anon, authenticated;
