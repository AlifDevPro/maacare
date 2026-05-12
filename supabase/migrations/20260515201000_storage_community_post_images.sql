-- Inline images in rich community posts (public URLs in sanitized HTML)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-post-images',
  'community-post-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "community_post_images_public_read" on storage.objects;
create policy "community_post_images_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'community-post-images');

drop policy if exists "community_post_images_insert_own" on storage.objects;
create policy "community_post_images_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'community-post-images'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );

drop policy if exists "community_post_images_update_own" on storage.objects;
create policy "community_post_images_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'community-post-images'
    and (storage.foldername(name))[1] = (auth.uid())::text
  )
  with check (
    bucket_id = 'community-post-images'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );

drop policy if exists "community_post_images_delete_own" on storage.objects;
create policy "community_post_images_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'community-post-images'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );
