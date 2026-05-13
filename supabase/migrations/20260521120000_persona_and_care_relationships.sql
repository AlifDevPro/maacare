-- Persona fields on profiles + care relationships for shared pregnancy read access.

alter table public.profiles
  add column if not exists primary_use_case text
    check (
      primary_use_case is null
      or primary_use_case in (
        'self_maternal',
        'partner_support',
        'student_research',
        'clinician',
        'other_caregiver'
      )
    );

comment on column public.profiles.primary_use_case is 'Drives onboarding and home gating: self_maternal (default when null), partner_support, student_research, clinician, other_caregiver.';

alter table public.profiles
  add column if not exists student_context jsonb;

alter table public.profiles
  add column if not exists clinician_context jsonb;

alter table public.profiles
  add column if not exists partner_support_context jsonb;

-- ---------------------------------------------------------------------------
-- Care relationships (subject = pregnant person / record owner, viewer = partner)
-- ---------------------------------------------------------------------------

create table if not exists public.care_relationships (
  id uuid primary key default gen_random_uuid(),
  subject_user_id uuid not null references public.profiles (id) on delete cascade,
  viewer_user_id uuid not null references public.profiles (id) on delete cascade,
  invited_by_user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'revoked')),
  permissions jsonb not null default '{"read_pregnancy": true, "read_vitals": true, "read_symptoms": true}'::jsonb,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint care_relationships_distinct_users check (subject_user_id <> viewer_user_id),
  constraint care_relationships_subject_viewer_unique unique (subject_user_id, viewer_user_id)
);

create index if not exists care_relationships_viewer_status_idx
  on public.care_relationships (viewer_user_id, status);

create index if not exists care_relationships_subject_status_idx
  on public.care_relationships (subject_user_id, status);

create trigger care_relationships_updated_at
  before update on public.care_relationships
  for each row execute function public.set_updated_at();

alter table public.care_relationships enable row level security;

-- Select: either party may read rows they participate in.
create policy "care_rel_select_participants"
  on public.care_relationships for select
  to authenticated
  using (auth.uid() = subject_user_id or auth.uid() = viewer_user_id);

-- Insert: subject invites viewer, or viewer requests link to subject.
create policy "care_rel_insert_by_party"
  on public.care_relationships for insert
  to authenticated
  with check (
    auth.uid() = invited_by_user_id
    and (
      (auth.uid() = subject_user_id and invited_by_user_id = subject_user_id)
      or (auth.uid() = viewer_user_id and invited_by_user_id = viewer_user_id)
    )
  );

-- Update: either party may update (accept / revoke); enforce in app for valid transitions.
create policy "care_rel_update_participants"
  on public.care_relationships for update
  to authenticated
  using (auth.uid() = subject_user_id or auth.uid() = viewer_user_id)
  with check (auth.uid() = subject_user_id or auth.uid() = viewer_user_id);

-- ---------------------------------------------------------------------------
-- Pregnancy: viewers with active care + read_pregnancy
-- ---------------------------------------------------------------------------

create policy "preg_select_care_viewer"
  on public.pregnancy_profiles for select
  to authenticated
  using (
    exists (
      select 1
      from public.care_relationships cr
      where cr.subject_user_id = pregnancy_profiles.user_id
        and cr.viewer_user_id = auth.uid()
        and cr.status = 'active'
        and coalesce((cr.permissions ->> 'read_pregnancy')::boolean, true)
    )
  );

-- ---------------------------------------------------------------------------
-- Vitals / symptoms: viewers with active care + flags
-- ---------------------------------------------------------------------------

create policy "vit_select_care_viewer"
  on public.vital_signs for select
  to authenticated
  using (
    exists (
      select 1
      from public.care_relationships cr
      where cr.subject_user_id = vital_signs.user_id
        and cr.viewer_user_id = auth.uid()
        and cr.status = 'active'
        and coalesce((cr.permissions ->> 'read_vitals')::boolean, true)
    )
  );

create policy "sym_select_care_viewer"
  on public.symptom_logs for select
  to authenticated
  using (
    exists (
      select 1
      from public.care_relationships cr
      where cr.subject_user_id = symptom_logs.user_id
        and cr.viewer_user_id = auth.uid()
        and cr.status = 'active'
        and coalesce((cr.permissions ->> 'read_symptoms')::boolean, true)
    )
  );
