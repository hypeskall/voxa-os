-- Migration 015 added RESIZED but omitted UPDATED, which is emitted by the
-- existing notes RPC. Restore that event so the atomic edit/history write works.
alter table public.appointment_history drop constraint appointment_history_event_check;
alter table public.appointment_history add constraint appointment_history_event_check
 check(event in (
  'CREATED','UPDATED','RESCHEDULED','RESIZED','CANCELLED','STATUS_CHANGED',
  'RESOURCES_ASSIGNED','DUPLICATE_OVERRIDE'
 ));
