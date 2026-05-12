-- Allow structured help-desk tickets from the Help page (stored in app_feedback).
alter table public.app_feedback drop constraint if exists app_feedback_kind_check;

alter table public.app_feedback
  add constraint app_feedback_kind_check
  check (kind in ('error', 'feedback', 'navigation', 'support_ticket'));
