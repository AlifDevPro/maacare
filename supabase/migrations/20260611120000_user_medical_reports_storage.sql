-- Storage columns for original report images on user_medical_reports
alter table public.user_medical_reports
  add column if not exists storage_bucket text,
  add column if not exists storage_path text;

comment on column public.user_medical_reports.storage_bucket is 'Supabase Storage bucket for the uploaded report image';
comment on column public.user_medical_reports.storage_path is 'Object path within storage_bucket, e.g. {userId}/reports/{reportId}/file.jpg';

-- Private bucket for health document images (report uploads)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'health-documents',
  'health-documents',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "health_documents_authenticated_select" on storage.objects;
create policy "health_documents_authenticated_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'health-documents'
    and (storage.foldername(name))[1] = (auth.uid())::text
    and (storage.foldername(name))[2] = 'reports'
  );

drop policy if exists "health_documents_authenticated_insert" on storage.objects;
create policy "health_documents_authenticated_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'health-documents'
    and (storage.foldername(name))[1] = (auth.uid())::text
    and (storage.foldername(name))[2] = 'reports'
  );

drop policy if exists "health_documents_authenticated_update" on storage.objects;
create policy "health_documents_authenticated_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'health-documents'
    and (storage.foldername(name))[1] = (auth.uid())::text
    and (storage.foldername(name))[2] = 'reports'
  )
  with check (
    bucket_id = 'health-documents'
    and (storage.foldername(name))[1] = (auth.uid())::text
    and (storage.foldername(name))[2] = 'reports'
  );

drop policy if exists "health_documents_authenticated_delete" on storage.objects;
create policy "health_documents_authenticated_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'health-documents'
    and (storage.foldername(name))[1] = (auth.uid())::text
    and (storage.foldername(name))[2] = 'reports'
  );
