-- Push enqueue must never roll back comments, likes, DMs, or in-app notifications.

create or replace function public.queue_push_for_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ch text;
begin
  if new.kind in ('community_reply', 'community_like') then
    ch := 'community';
  else
    ch := 'system';
  end if;

  begin
    insert into public.push_queue (user_id, channel, title, body, link_path, tag)
    values (
      new.user_id,
      ch,
      new.title,
      new.body,
      new.link_path,
      'notif-' || new.id::text
    );
  exception
    when others then
      raise warning 'queue_push_for_notification: %', sqlerrm;
  end;

  return new;
end;
$$;

create or replace function public.queue_push_for_dm_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
  sender_name text;
  preview text;
begin
  select
    case
      when c.user_low = new.sender_id then c.user_high
      else c.user_low
    end
    into recipient
  from public.dm_conversations c
  where c.id = new.conversation_id;

  if recipient is null or recipient = new.sender_id then
    return new;
  end if;

  select coalesce(nullif(trim(p.display_name), ''), 'Someone')
    into sender_name
  from public.profiles p
  where p.id = new.sender_id;

  preview := left(trim(regexp_replace(new.body, '\s+', ' ', 'g')), 120);

  begin
    insert into public.push_queue (user_id, channel, title, body, link_path, tag)
    values (
      recipient,
      'dm',
      sender_name || ' sent a message',
      nullif(preview, ''),
      '/messages/' || new.conversation_id::text,
      'dm-' || new.conversation_id::text
    );
  exception
    when others then
      raise warning 'queue_push_for_dm_message: %', sqlerrm;
  end;

  return new;
end;
$$;
