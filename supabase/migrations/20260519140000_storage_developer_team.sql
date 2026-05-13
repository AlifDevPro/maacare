-- Team card photos on landing: public bucket, path {user_id}/card.{ext} (same pattern as avatars).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'developer_team',
  'developer_team',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "developer_team_public_read" on storage.objects;
create policy "developer_team_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'developer_team');

drop policy if exists "developer_team_authenticated_insert" on storage.objects;
create policy "developer_team_authenticated_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'developer_team'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );

drop policy if exists "developer_team_authenticated_update" on storage.objects;
create policy "developer_team_authenticated_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'developer_team'
    and (storage.foldername(name))[1] = (auth.uid())::text
  )
  with check (
    bucket_id = 'developer_team'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );

drop policy if exists "developer_team_authenticated_delete" on storage.objects;
create policy "developer_team_authenticated_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'developer_team'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );
