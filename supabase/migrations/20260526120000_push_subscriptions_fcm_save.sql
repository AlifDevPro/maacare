-- Ensure FCM token saves work (nullable legacy web-push columns + fcm_token unique).

alter table public.push_subscriptions
  add column if not exists fcm_token text,
  add column if not exists platform text;

update public.push_subscriptions
set platform = 'web'
where platform is null;

alter table public.push_subscriptions
  alter column platform set default 'web';

alter table public.push_subscriptions
  alter column platform set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'push_subscriptions_platform_check'
  ) then
    alter table public.push_subscriptions
      add constraint push_subscriptions_platform_check
      check (platform in ('web', 'android', 'ios'));
  end if;
end $$;

alter table public.push_subscriptions alter column endpoint drop not null;
alter table public.push_subscriptions alter column p256dh drop not null;
alter table public.push_subscriptions alter column auth_secret drop not null;

alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_fcm_token_key;

create unique index if not exists push_subscriptions_fcm_token_uidx
  on public.push_subscriptions (fcm_token)
  where fcm_token is not null;

alter table public.push_subscriptions
  add constraint push_subscriptions_fcm_token_key unique (fcm_token);

create index if not exists push_subscriptions_user_platform_idx
  on public.push_subscriptions (user_id, platform);
