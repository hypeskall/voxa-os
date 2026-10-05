-- Appointment reminders use the clinic's local daytime window. Other
-- transactional messages (confirmation/cancellation/results) are unaffected.
create function private.reminder_delivery_at(starts_at timestamptz,offset_minutes integer,clinic_timezone text)
returns timestamptz language sql stable set search_path='' as $$
 select case
  when due::time < time '08:00' then (due::date-1+time '19:55') at time zone clinic_timezone
  when due::time >= time '20:00' then (due::date+time '19:55') at time zone clinic_timezone
  else due at time zone clinic_timezone
 end from (select (starts_at-make_interval(mins=>offset_minutes)) at time zone clinic_timezone due) value
$$;
revoke all on function private.reminder_delivery_at(timestamptz,integer,text) from public,anon,authenticated;

create or replace function public.enqueue_due_reminders(reference_time timestamptz default now()) returns integer
language plpgsql security definer set search_path='' as $$
declare item record; total integer=0; confirmation uuid; begin
 if coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role',nullif(current_setting('request.jwt.claim.role',true),''),'')<>'service_role' then raise exception 'Worker access denied' using errcode='42501'; end if;
 for item in
  select a.id,a.clinic_id,a.patient_id,a.start_at,offset_value
  from public.appointments a
  join public.clinic_notification_settings n on n.clinic_id=a.clinic_id
  join public.services s on s.id=a.service_id and s.clinic_id=a.clinic_id
  join public.clinics c on c.id=a.clinic_id
  cross join lateral unnest(coalesce(s.reminder_offsets_minutes,n.reminder_offsets_minutes)) offset_value
  where a.status in ('PENDING','CONFIRMED') and a.start_at>reference_time
   and private.reminder_delivery_at(a.start_at,offset_value,c.timezone)
    between reference_time-interval '5 minutes' and reference_time+interval '5 minutes'
 loop
  select id into confirmation from public.appointment_confirmations where appointment_id=item.id and revoked_at is null and expires_at>reference_time order by created_at desc limit 1;
  total=total+private.queue_notification(item.clinic_id,'APPOINTMENT_REMINDER',item.id,item.patient_id,confirmation,reference_time,'reminder:'||item.id||':'||item.offset_value);
 end loop;
 return total;
end $$;

-- Keep the existing subscription/lease/attempt checks; block night-time retries
-- and reminders for past or cancelled appointments at the actual claim time.
create function private.reminder_claimable(cid uuid,aid uuid,reference_time timestamptz)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.appointments a join public.clinics c on c.id=a.clinic_id
  where a.id=aid and a.clinic_id=cid and a.status in ('PENDING','CONFIRMED') and a.start_at>reference_time
   and (reference_time at time zone c.timezone)::time>=time '08:00'
   and (reference_time at time zone c.timezone)::time<time '20:00')
$$;
revoke all on function private.reminder_claimable(uuid,uuid,timestamptz) from public,anon,authenticated;
do $$ declare definition text; anchor text='where private.organization_entitled(organization_id) and ('; begin
 definition=pg_get_functiondef('public.claim_notification_jobs(integer)'::regprocedure);
 if position(anchor in definition)=0 then raise exception 'Unexpected notification claim definition'; end if;
 definition=replace(definition,anchor,
  'where private.organization_entitled(organization_id) and (event<>''APPOINTMENT_REMINDER'' or private.reminder_claimable(clinic_id,appointment_id,now())) and (');
 execute definition;
end $$;
