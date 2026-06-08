-- Expose dm_participants to Supabase Realtime for read-state badge updates.

DO $body$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'dm_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_participants;
  END IF;
END
$body$;
