-- Fast unread DM thread count for header badge (security invoker = caller RLS).
create or replace function public.dm_unread_conversation_count()
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::int
  from public.dm_conversations c
  where (c.user_low = auth.uid() or c.user_high = auth.uid())
    and exists (
      select 1
      from public.dm_messages m
      where m.conversation_id = c.id
        and m.sender_id <> auth.uid()
        and m.created_at > coalesce(
          (
            select p.last_read_at
            from public.dm_participants p
            where p.conversation_id = c.id
              and p.user_id = auth.uid()
            limit 1
          ),
          '-infinity'::timestamptz
        )
    );
$$;

revoke all on function public.dm_unread_conversation_count() from public;
grant execute on function public.dm_unread_conversation_count() to authenticated;
