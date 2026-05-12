alter table public.community_posts
  add column if not exists body_format text not null default 'plain';

alter table public.community_posts
  drop constraint if exists community_posts_body_format_check;

alter table public.community_posts
  add constraint community_posts_body_format_check
  check (body_format in ('plain', 'html'));

comment on column public.community_posts.body_format is 'plain: body is plain text; html: body is sanitized HTML from rich editor.';
