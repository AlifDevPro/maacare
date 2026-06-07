-- User medical reports: persistent storage + per-user RAG chunks

create table public.user_medical_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Medical report',
  input_mode text not null check (input_mode in ('file', 'text')),
  file_name text,
  file_mime text,
  file_size_bytes int,
  extracted_text text,
  analysis jsonb not null default '{}'::jsonb,
  is_medical_report boolean not null default true,
  risk_level text,
  provider text,
  extraction_mode text,
  embedding_status text not null default 'pending'
    check (embedding_status in ('pending', 'ready', 'failed', 'skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index user_medical_reports_user_created_idx
  on public.user_medical_reports (user_id, created_at desc);

create index user_medical_reports_user_title_idx
  on public.user_medical_reports (user_id, title);

create trigger user_medical_reports_updated_at
  before update on public.user_medical_reports
  for each row execute function public.set_updated_at();

create table public.user_medical_report_chunks (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.user_medical_reports (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  chunk_index int not null,
  title text,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding_model text not null default 'text-embedding-004',
  embedding vector(768),
  created_at timestamptz not null default now(),
  unique (report_id, chunk_index)
);

create index user_medical_report_chunks_report_idx
  on public.user_medical_report_chunks (report_id);

create index user_medical_report_chunks_user_idx
  on public.user_medical_report_chunks (user_id);

create index if not exists user_medical_report_chunks_embedding_idx
  on public.user_medical_report_chunks
  using hnsw (embedding vector_cosine_ops);

alter table public.user_medical_reports enable row level security;
alter table public.user_medical_report_chunks enable row level security;

create policy "user_medical_reports_own_select"
  on public.user_medical_reports for select
  using (auth.uid() = user_id);

create policy "user_medical_reports_own_insert"
  on public.user_medical_reports for insert
  with check (auth.uid() = user_id);

create policy "user_medical_reports_own_update"
  on public.user_medical_reports for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_medical_reports_own_delete"
  on public.user_medical_reports for delete
  using (auth.uid() = user_id);

create policy "user_medical_report_chunks_own_select"
  on public.user_medical_report_chunks for select
  using (auth.uid() = user_id);

create policy "user_medical_report_chunks_own_insert"
  on public.user_medical_report_chunks for insert
  with check (auth.uid() = user_id);

create policy "user_medical_report_chunks_own_delete"
  on public.user_medical_report_chunks for delete
  using (auth.uid() = user_id);

-- Semantic search scoped to the authenticated user's reports only.
create or replace function public.match_user_report_chunks(
  p_user_id uuid,
  query_embedding vector(768),
  match_count int default 6,
  min_similarity float default 0.08
)
returns table (
  chunk_id uuid,
  report_id uuid,
  report_title text,
  report_date timestamptz,
  content text,
  title text,
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
    c.report_id,
    r.title,
    r.created_at,
    c.content,
    c.title,
    c.chunk_index,
    (1 - (c.embedding <=> query_embedding))::double precision as similarity
  from public.user_medical_report_chunks c
  join public.user_medical_reports r on r.id = c.report_id
  where c.user_id = p_user_id
    and r.user_id = p_user_id
    and r.is_medical_report = true
    and c.embedding is not null
    and auth.uid() = p_user_id
    and (1 - (c.embedding <=> query_embedding)) >= min_similarity
  order by c.embedding <=> query_embedding
  limit least(match_count, 20);
$$;

grant execute on function public.match_user_report_chunks(uuid, vector, int, float) to authenticated;
