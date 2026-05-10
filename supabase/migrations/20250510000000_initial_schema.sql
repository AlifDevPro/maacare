-- MaaCare — Supabase schema: auth-linked profiles, health data, RAG (pgvector), community.
-- Apply via Supabase SQL editor or: supabase db push / migration tooling.

create extension if not exists "uuid-ossp";
create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- Roles & helpers
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('user', 'moderator', 'admin');

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p where p.id = uid and p.role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text not null,
  phone text,
  avatar_url text,
  role public.user_role not null default 'user',
  language text not null default 'en' check (language in ('en', 'bn')),
  date_of_birth date,
  sex text check (sex is null or sex in ('female', 'male', 'other', 'unknown')),
  timezone text default 'UTC',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);
create index profiles_email_idx on public.profiles (lower(email));

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- First registered user becomes admin (only when profiles table is empty).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  select count(*) into n from public.profiles;
  insert into public.profiles (id, email, display_name, role, language)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    case when n = 0 then 'admin'::public.user_role else 'user'::public.user_role end,
    case
      when new.raw_user_meta_data->>'language' in ('en', 'bn')
      then new.raw_user_meta_data->>'language'
      else 'en'
    end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Health — core profile & emergency
-- ---------------------------------------------------------------------------

create table public.user_health_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  blood_type text check (
    blood_type is null or blood_type in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown')
  ),
  height_cm numeric(5, 2),
  weight_kg numeric(6, 2),
  bmi numeric(5, 2),
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relation text,
  primary_care_provider text,
  insurance_provider text,
  insurance_member_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_health_profiles_updated_at
  before update on public.user_health_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Medical history
-- ---------------------------------------------------------------------------

create table public.medical_conditions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  condition_name text not null,
  icd10_code text,
  diagnosed_on date,
  resolved_on date,
  severity text check (severity is null or severity in ('mild', 'moderate', 'severe')),
  status text not null default 'active' check (status in ('active', 'resolved', 'remission')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index medical_conditions_user_idx on public.medical_conditions (user_id);

create trigger medical_conditions_updated_at
  before update on public.medical_conditions
  for each row execute function public.set_updated_at();

create table public.allergies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  allergen_type text not null check (allergen_type in ('medication', 'food', 'environmental', 'other')),
  name text not null,
  reaction text,
  severity text check (severity is null or severity in ('mild', 'moderate', 'severe', 'life_threatening')),
  diagnosed_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index allergies_user_idx on public.allergies (user_id);

create trigger allergies_updated_at
  before update on public.allergies
  for each row execute function public.set_updated_at();

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  generic_name text,
  dose text,
  frequency text,
  route text,
  started_on date,
  ended_on date,
  prescribed_by text,
  indication text,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index medications_user_idx on public.medications (user_id);

create trigger medications_updated_at
  before update on public.medications
  for each row execute function public.set_updated_at();

create table public.immunizations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  vaccine_name text not null,
  dose_number int,
  administered_on date,
  provider text,
  lot_number text,
  notes text,
  created_at timestamptz not null default now()
);

create index immunizations_user_idx on public.immunizations (user_id);

-- ---------------------------------------------------------------------------
-- Pregnancy & postpartum tracking
-- ---------------------------------------------------------------------------

create table public.pregnancy_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  pregnancy_status text not null default 'pregnant'
    check (pregnancy_status in ('planning', 'pregnant', 'postpartum', 'not_applicable')),
  lmp_date date,
  edd_date date,
  gestational_age_weeks int,
  gravida int,
  para int,
  multiple_gestation boolean default false,
  fetus_count int default 1,
  risk_flags jsonb default '[]'::jsonb,
  trimester_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger pregnancy_profiles_updated_at
  before update on public.pregnancy_profiles
  for each row execute function public.set_updated_at();

create table public.vital_signs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  recorded_at timestamptz not null default now(),
  systolic_bp int,
  diastolic_bp int,
  heart_rate_bpm int,
  weight_kg numeric(6, 2),
  temperature_c numeric(4, 1),
  glucose_mg_dl numeric(6, 2),
  spo2_pct int,
  notes text,
  source text default 'self_reported'
);

create index vital_signs_user_time_idx on public.vital_signs (user_id, recorded_at desc);

create table public.symptom_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  logged_at timestamptz not null default now(),
  symptom_codes text[] default '{}',
  title text,
  description text,
  severity int check (severity is null or (severity >= 1 and severity <= 10)),
  body_area text,
  metadata jsonb default '{}'::jsonb
);

create index symptom_logs_user_time_idx on public.symptom_logs (user_id, logged_at desc);

create table public.appointments (
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

create index appointments_user_time_idx on public.appointments (user_id, scheduled_at);

create trigger appointments_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

create table public.health_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  storage_bucket text not null default 'health-documents',
  storage_path text not null,
  mime_type text,
  file_size_bytes bigint,
  uploaded_at timestamptz not null default now(),
  notes text
);

create index health_documents_user_idx on public.health_documents (user_id);

-- ---------------------------------------------------------------------------
-- Community (optional product surface)
-- ---------------------------------------------------------------------------

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text,
  body text not null,
  is_pinned boolean default false,
  moderation_status text not null default 'visible'
    check (moderation_status in ('visible', 'hidden', 'pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index community_posts_created_idx on public.community_posts (created_at desc);

create trigger community_posts_updated_at
  before update on public.community_posts
  for each row execute function public.set_updated_at();

create table public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  moderation_status text not null default 'visible'
    check (moderation_status in ('visible', 'hidden', 'pending')),
  created_at timestamptz not null default now()
);

create index community_comments_post_idx on public.community_comments (post_id);

-- ---------------------------------------------------------------------------
-- RAG — documents & chunks (Gemini text-embedding-004 → 768 dims)
-- ---------------------------------------------------------------------------

create table public.rag_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source text,
  category text,
  description text,
  mime_type text,
  storage_bucket text,
  storage_path text,
  raw_extracted_text text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rag_documents_category_idx on public.rag_documents (category);
create index rag_documents_updated_idx on public.rag_documents (updated_at desc);

create trigger rag_documents_updated_at
  before update on public.rag_documents
  for each row execute function public.set_updated_at();

create table public.rag_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.rag_documents (id) on delete cascade,
  chunk_index int not null,
  title text,
  content text not null,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  embedding_model text not null default 'text-embedding-004',
  embedding vector(768),
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index rag_chunks_document_idx on public.rag_chunks (document_id);

create index if not exists rag_chunks_embedding_idx on public.rag_chunks
  using hnsw (embedding vector_cosine_ops);

-- Semantic search for authenticated users (RPC only; no direct chunk reads required).
create or replace function public.match_rag_chunks_for_user(
  query_embedding vector(768),
  match_count int default 8,
  min_similarity float default 0.05
)
returns table (
  chunk_id uuid,
  document_id uuid,
  content text,
  title text,
  source text,
  category text,
  chunk_index int,
  similarity double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.document_id,
    c.content,
    c.title,
    c.source,
    d.category,
    c.chunk_index,
    (1 - (c.embedding <=> query_embedding))::double precision as similarity
  from public.rag_chunks c
  join public.rag_documents d on d.id = c.document_id
  where c.embedding is not null
    and (1 - (c.embedding <=> query_embedding)) >= min_similarity
  order by c.embedding <=> query_embedding
  limit least(match_count, 50);
$$;

grant execute on function public.match_rag_chunks_for_user(vector, int, float) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_health_profiles enable row level security;
alter table public.medical_conditions enable row level security;
alter table public.allergies enable row level security;
alter table public.medications enable row level security;
alter table public.immunizations enable row level security;
alter table public.pregnancy_profiles enable row level security;
alter table public.vital_signs enable row level security;
alter table public.symptom_logs enable row level security;
alter table public.appointments enable row level security;
alter table public.health_documents enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.rag_documents enable row level security;
alter table public.rag_chunks enable row level security;

-- Profiles
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin(auth.uid()));

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Generic: user-owned tables
create policy "health_own_select" on public.user_health_profiles for select using (auth.uid() = user_id);
create policy "health_own_insert" on public.user_health_profiles for insert with check (auth.uid() = user_id);
create policy "health_own_update" on public.user_health_profiles for update using (auth.uid() = user_id);

create policy "mc_own_select" on public.medical_conditions for select using (auth.uid() = user_id);
create policy "mc_own_mutate" on public.medical_conditions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "all_own_select" on public.allergies for select using (auth.uid() = user_id);
create policy "all_own_mutate" on public.allergies for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "med_own_select" on public.medications for select using (auth.uid() = user_id);
create policy "med_own_mutate" on public.medications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "imm_own_select" on public.immunizations for select using (auth.uid() = user_id);
create policy "imm_own_mutate" on public.immunizations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "preg_own_select" on public.pregnancy_profiles for select using (auth.uid() = user_id);
create policy "preg_own_mutate" on public.pregnancy_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "vit_own_select" on public.vital_signs for select using (auth.uid() = user_id);
create policy "vit_own_mutate" on public.vital_signs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "sym_own_select" on public.symptom_logs for select using (auth.uid() = user_id);
create policy "sym_own_mutate" on public.symptom_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "appt_own_select" on public.appointments for select using (auth.uid() = user_id);
create policy "appt_own_mutate" on public.appointments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "hd_own_select" on public.health_documents for select using (auth.uid() = user_id);
create policy "hd_own_mutate" on public.health_documents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Community: visible posts to authenticated users; authors edit own
create policy "posts_read_visible"
  on public.community_posts for select
  using (moderation_status = 'visible' or auth.uid() = author_id or public.is_admin(auth.uid()));

create policy "posts_insert_own"
  on public.community_posts for insert
  with check (auth.uid() = author_id);

create policy "posts_update_own"
  on public.community_posts for update
  using (auth.uid() = author_id or public.is_admin(auth.uid()));

create policy "comments_read"
  on public.community_comments for select
  using (
    exists (
      select 1 from public.community_posts p
      where p.id = post_id
        and (p.moderation_status = 'visible' or auth.uid() = p.author_id or public.is_admin(auth.uid()))
    )
  );

create policy "comments_insert_own"
  on public.community_comments for insert
  with check (auth.uid() = author_id);

-- RAG: admin manages content; no direct select for normal users (search via RPC only)
create policy "rag_docs_admin_all"
  on public.rag_documents for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy "rag_chunks_admin_all"
  on public.rag_chunks for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
