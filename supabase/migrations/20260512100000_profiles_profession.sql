-- Optional profession / role for product segmentation (e.g. clinicians vs caregivers).
alter table public.profiles
  add column if not exists profession text;

comment on column public.profiles.profession is 'Self-reported role: parent_caregiver, clinician, other — used for UX segmentation, not auth role.';
