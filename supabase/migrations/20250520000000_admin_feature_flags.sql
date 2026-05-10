create table if not exists public.admin_feature_flags (
  key text primary key,
  enabled boolean not null default true,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint admin_feature_flags_key_check
    check (key in ('ai_chat', 'community', 'reports', 'emergency'))
);

drop trigger if exists admin_feature_flags_updated_at on public.admin_feature_flags;
create trigger admin_feature_flags_updated_at
  before update on public.admin_feature_flags
  for each row execute function public.set_updated_at();

alter table public.admin_feature_flags enable row level security;

drop policy if exists "admin_feature_flags_read_authenticated" on public.admin_feature_flags;
create policy "admin_feature_flags_read_authenticated"
  on public.admin_feature_flags
  for select
  to authenticated
  using (true);

drop policy if exists "admin_feature_flags_write_admin" on public.admin_feature_flags;
create policy "admin_feature_flags_write_admin"
  on public.admin_feature_flags
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

insert into public.admin_feature_flags (key, enabled)
values
  ('ai_chat', true),
  ('community', true),
  ('reports', true),
  ('emergency', true)
on conflict (key) do nothing;
