alter table public.community_comments
  add column if not exists parent_comment_id uuid null references public.community_comments(id) on delete cascade;

create index if not exists community_comments_parent_idx
  on public.community_comments (parent_comment_id, created_at);

