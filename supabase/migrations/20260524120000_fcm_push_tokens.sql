-- FCM device tokens (web, Android, iOS) alongside legacy Web Push columns.

alter table public.push_subscriptions
  add column if not exists fcm_token text,
  add column if not exists platform text not null default 'web'
    check (platform in ('web', 'android', 'ios'));

create unique index if not exists push_subscriptions_fcm_token_uidx
  on public.push_subscriptions (fcm_token)
  where fcm_token is not null;

-- Required for Supabase upsert onConflict: 'fcm_token'
alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_fcm_token_key;

alter table public.push_subscriptions
  add constraint push_subscriptions_fcm_token_key unique (fcm_token);

alter table public.push_subscriptions alter column endpoint drop not null;
alter table public.push_subscriptions alter column p256dh drop not null;
alter table public.push_subscriptions alter column auth_secret drop not null;
