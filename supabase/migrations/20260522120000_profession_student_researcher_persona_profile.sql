-- First-class student/researcher profession + optional unified persona JSON.

update public.profiles
set profession = 'student_researcher'
where profession = 'other';

alter table public.profiles
  add column if not exists persona_profile jsonb not null default '{}'::jsonb;

comment on column public.profiles.persona_profile is
  'Optional persona-specific fields (e.g. parent card prefs). Clinician/student details may also live in clinician_context / student_context.';

comment on column public.profiles.profession is
  'Self-reported role: parent_caregiver, clinician, student_researcher — used for UX segmentation, not auth role.';
