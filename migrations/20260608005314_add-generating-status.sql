-- Allow a transient 'generating' status while the background AI job runs.
alter table public.reports drop constraint if exists reports_status_check;
alter table public.reports add constraint reports_status_check
  check (status in ('generating','ready','sent'));
