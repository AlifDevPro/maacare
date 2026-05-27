-- Live docs CMS tables, schedule controls, versions, and team cards.

create table if not exists public.docs_publication_settings (
  key text primary key default 'primary',
  enabled boolean not null default true,
  start_at timestamptz,
  end_at timestamptz,
  duration_minutes int,
  override_public_window boolean not null default false,
  published_snapshot_id uuid,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint docs_publication_settings_key_check check (key = 'primary'),
  constraint docs_publication_settings_duration_check check (duration_minutes is null or duration_minutes > 0),
  constraint docs_publication_settings_window_check check (end_at is null or start_at is null or end_at >= start_at)
);

create table if not exists public.docs_sections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  section_type text not null default 'technical',
  body_md text not null default '',
  body_html text not null default '',
  summary text not null default '',
  status text not null default 'draft',
  is_visible boolean not null default true,
  sort_order int not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint docs_sections_status_check check (status in ('draft', 'published')),
  constraint docs_sections_type_check check (
    section_type in (
      'pitch',
      'technical',
      'live_matrix',
      'architecture',
      'data_flow',
      'team',
      'changelog',
      'custom'
    )
  )
);

create table if not exists public.docs_section_versions (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.docs_sections (id) on delete cascade,
  version_no int not null,
  title text not null,
  body_md text not null default '',
  body_html text not null default '',
  summary text not null default '',
  status text not null default 'draft',
  section_type text not null default 'technical',
  metadata jsonb not null default '{}'::jsonb,
  snapshot_kind text not null default 'save',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint docs_section_versions_unique unique (section_id, version_no),
  constraint docs_section_versions_status_check check (status in ('draft', 'published')),
  constraint docs_section_versions_snapshot_kind_check check (snapshot_kind in ('save', 'publish', 'restore'))
);

create table if not exists public.docs_team_members (
  id uuid primary key default gen_random_uuid(),
  avatar_url text,
  avatar_width int,
  avatar_height int,
  full_name text not null,
  role text not null,
  email text not null,
  bio text not null default '',
  display_order int not null default 100,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint docs_team_members_email_unique unique (email),
  constraint docs_team_members_avatar_width_check check (avatar_width is null or avatar_width > 0),
  constraint docs_team_members_avatar_height_check check (avatar_height is null or avatar_height > 0)
);

create index if not exists docs_sections_runtime_idx
  on public.docs_sections (status, is_visible, sort_order, slug);

create index if not exists docs_sections_type_idx
  on public.docs_sections (section_type, sort_order);

create index if not exists docs_versions_section_created_idx
  on public.docs_section_versions (section_id, created_at desc);

create index if not exists docs_team_members_public_idx
  on public.docs_team_members (active, display_order);

drop trigger if exists docs_publication_settings_updated_at on public.docs_publication_settings;
create trigger docs_publication_settings_updated_at
  before update on public.docs_publication_settings
  for each row execute function public.set_updated_at();

drop trigger if exists docs_sections_updated_at on public.docs_sections;
create trigger docs_sections_updated_at
  before update on public.docs_sections
  for each row execute function public.set_updated_at();

drop trigger if exists docs_team_members_updated_at on public.docs_team_members;
create trigger docs_team_members_updated_at
  before update on public.docs_team_members
  for each row execute function public.set_updated_at();

create or replace function public.docs_public_window_active()
returns boolean
language sql
stable
as $$
  select coalesce(
    (
      select
        s.enabled
        and (
          s.override_public_window
          or (
            (s.start_at is null or now() >= s.start_at)
            and (s.end_at is null or now() <= s.end_at)
          )
        )
      from public.docs_publication_settings s
      where s.key = 'primary'
      limit 1
    ),
    false
  );
$$;

alter table public.docs_publication_settings enable row level security;
alter table public.docs_sections enable row level security;
alter table public.docs_section_versions enable row level security;
alter table public.docs_team_members enable row level security;

drop policy if exists "docs_publication_settings_public_read" on public.docs_publication_settings;
create policy "docs_publication_settings_public_read"
  on public.docs_publication_settings
  for select
  to anon, authenticated
  using (true);

drop policy if exists "docs_publication_settings_admin_all" on public.docs_publication_settings;
create policy "docs_publication_settings_admin_all"
  on public.docs_publication_settings
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "docs_sections_public_read" on public.docs_sections;
create policy "docs_sections_public_read"
  on public.docs_sections
  for select
  to anon, authenticated
  using (
    status = 'published'
    and is_visible = true
    and public.docs_public_window_active()
  );

drop policy if exists "docs_sections_admin_all" on public.docs_sections;
create policy "docs_sections_admin_all"
  on public.docs_sections
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "docs_section_versions_admin_only" on public.docs_section_versions;
create policy "docs_section_versions_admin_only"
  on public.docs_section_versions
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "docs_team_members_public_read" on public.docs_team_members;
create policy "docs_team_members_public_read"
  on public.docs_team_members
  for select
  to anon, authenticated
  using (
    active = true
    and public.docs_public_window_active()
  );

drop policy if exists "docs_team_members_admin_all" on public.docs_team_members;
create policy "docs_team_members_admin_all"
  on public.docs_team_members
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

grant select on table public.docs_publication_settings to anon, authenticated;
grant select on table public.docs_sections to anon, authenticated;
grant select on table public.docs_team_members to anon, authenticated;

insert into public.docs_publication_settings (
  key,
  enabled,
  start_at,
  end_at,
  duration_minutes
)
values (
  'primary',
  true,
  '2026-06-10 00:00:00+06',
  '2026-06-14 23:59:00+06',
  null
)
on conflict (key) do update
set
  enabled = excluded.enabled,
  start_at = excluded.start_at,
  end_at = excluded.end_at,
  duration_minutes = excluded.duration_minutes;

insert into public.docs_sections (slug, title, section_type, body_md, body_html, summary, status, is_visible, sort_order, metadata)
values
  (
    'problem',
    'Problem Definition',
    'pitch',
    'Maternal health navigation is fragmented across guidance, appointments, and practical day to day support.',
    '<p>Maternal health navigation is fragmented across guidance, appointments, and practical day to day support.</p>',
    'The challenge MaaCare addresses.',
    'published',
    true,
    10,
    '{"anchors":["problem"]}'::jsonb
  ),
  (
    'solution',
    'Solution Overview',
    'pitch',
    'MaaCare combines multilingual guidance, planner tools, and community support in one adaptive platform.',
    '<p>MaaCare combines multilingual guidance, planner tools, and community support in one adaptive platform.</p>',
    'What MaaCare delivers for users.',
    'published',
    true,
    20,
    '{"anchors":["solution"]}'::jsonb
  ),
  (
    'architecture',
    'Technical Architecture',
    'architecture',
    'The platform is built on Next.js app routing, Supabase storage and RLS, and AI route handlers with guarded prompts.',
    '<p>The platform is built on Next.js app routing, Supabase storage and RLS, and AI route handlers with guarded prompts.</p>',
    'System level architecture summary.',
    'published',
    true,
    30,
    '{"anchors":["architecture"]}'::jsonb
  ),
  (
    'ai-layer',
    'AI Layer',
    'technical',
    'AI endpoints use multilingual prompt composition, intent planning, quality guards, and retrieval aware generation.',
    '<p>AI endpoints use multilingual prompt composition, intent planning, quality guards, and retrieval aware generation.</p>',
    'How AI is orchestrated in production.',
    'published',
    true,
    40,
    '{"anchors":["ai-layer"]}'::jsonb
  ),
  (
    'team',
    'Team',
    'team',
    'Core contributors and maintainers of the MaaCare platform.',
    '<p>Core contributors and maintainers of the MaaCare platform.</p>',
    'People behind delivery.',
    'published',
    true,
    90,
    '{"anchors":["team"]}'::jsonb
  ),
  (
    'changelog',
    'Changelog',
    'changelog',
    'Published snapshot history and notable platform updates.',
    '<p>Published snapshot history and notable platform updates.</p>',
    'Release and publication history.',
    'published',
    true,
    100,
    '{"anchors":["changelog"]}'::jsonb
  )
on conflict (slug) do nothing;
