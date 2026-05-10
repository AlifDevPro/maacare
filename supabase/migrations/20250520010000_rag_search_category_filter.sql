create or replace function public.match_rag_chunks_for_user(
  query_embedding vector(768),
  match_count int default 8,
  min_similarity float default 0.05,
  filter_categories text[] default null
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
    and (
      filter_categories is null
      or coalesce(lower(d.category), '') = any (
        select lower(x) from unnest(filter_categories) as x
      )
    )
  order by c.embedding <=> query_embedding
  limit least(match_count, 50);
$$;

grant execute on function public.match_rag_chunks_for_user(vector, int, float, text[]) to authenticated;
