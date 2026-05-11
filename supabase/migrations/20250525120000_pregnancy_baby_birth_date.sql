-- Optional delivery date for postpartum week calculation on home and postpartum hub.
alter table public.pregnancy_profiles
  add column if not exists baby_birth_date date;

comment on column public.pregnancy_profiles.baby_birth_date is 'Actual delivery date; drives postpartum week when pregnancy_status is postpartum.';
