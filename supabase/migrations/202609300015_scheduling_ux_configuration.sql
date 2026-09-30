-- Clinic-owned scheduling presentation rules and race-safe appointment resizing.
-- Slot increment is independent from service duration.

alter table public.clinics
 add column scheduling_increment_minutes integer not null default 15,
 add column calendar_visible_start time not null default time '08:00',
 add column calendar_visible_end time not null default time '20:00';

alter table public.clinics
 add constraint clinics_scheduling_increment_check
  check(scheduling_increment_minutes between 5 and 120),
 add constraint clinics_calendar_visible_range_check
  check(calendar_visible_end > calendar_visible_start);

alter table public.appointment_history drop constraint appointment_history_event_check;
alter table public.appointment_history add constraint appointment_history_event_check
 check(event in (
  'CREATED','RESCHEDULED','RESIZED','CANCELLED','STATUS_CHANGED',
  'RESOURCES_ASSIGNED','DUPLICATE_OVERRIDE'
 ));

create function public.get_reschedule_slots(
 cid uuid, aid uuid, window_start timestamptz, window_end timestamptz,
 doctor_id uuid default null, step_minutes integer default 15
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare current public.appointments; cursor_at timestamptz; resolved jsonb; slots jsonb='[]'; begin
 if not private.has_permission(cid,'appointments.read') then raise exception 'Access denied' using errcode='42501'; end if;
 if window_end<=window_start or window_end>window_start+interval '31 days' or step_minutes not between 5 and 120 then raise exception 'Invalid slot window'; end if;
 select * into current from public.appointments where id=aid and clinic_id=cid and status<>'CANCELLED';
 if current.id is null then raise exception 'Appointment unavailable'; end if;
 cursor_at=window_start;
 while cursor_at<window_end loop
  resolved=private.resolve_assignment(cid,current.service_id,cursor_at,doctor_id,null,'{}',aid);
  if (resolved->>'ok')::boolean and ((resolved->'assignment'->>'end_at')::timestamptz)<=window_end then
   slots=slots||jsonb_build_array(jsonb_build_object('start_at',cursor_at,'end_at',resolved->'assignment'->'end_at','assignment',resolved->'assignment'));
  end if;
  cursor_at=cursor_at+make_interval(mins=>step_minutes);
 end loop;
 return slots;
end $$;

create function public.resize_appointment(
 cid uuid, aid uuid, new_duration_minutes integer, expected_updated_at timestamptz
) returns jsonb language plpgsql security definer set search_path='' as $$
declare current public.appointments; changed public.appointments; resource record;
 increment_minutes integer; new_end timestamptz; occupied_start timestamptz; occupied_end timestamptz; begin
 if not private.has_permission(cid,'appointments.manage') then raise exception 'Access denied' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(cid::text,21));
 select * into current from public.appointments where id=aid and clinic_id=cid for update;
 if current.id is null or current.status in ('CANCELLED','COMPLETED','NO_SHOW') then raise exception 'Appointment unavailable'; end if;
 if expected_updated_at is null or current.updated_at<>expected_updated_at then raise exception 'Stale version' using errcode='40001'; end if;
 select scheduling_increment_minutes into increment_minutes from public.clinics where id=cid and archived_at is null;
 if new_duration_minutes not between 5 and 1440 or mod(new_duration_minutes,increment_minutes)<>0 then raise exception 'Invalid duration'; end if;
 new_end=current.start_at+make_interval(mins=>new_duration_minutes);
 occupied_start=current.start_at-make_interval(mins=>current.buffer_before);
 occupied_end=new_end+make_interval(mins=>current.buffer_after);
 if not private.resource_available(cid,'clinic',cid,occupied_start,occupied_end) then
  return jsonb_build_object('ok',false,'conflicts',jsonb_build_array(jsonb_build_object('code','OUTSIDE_WORKING_HOURS')));
 end if;
 if current.doctor_location_id is not null and (
  not private.resource_available(cid,'doctor',current.doctor_location_id,occupied_start,occupied_end)
  or private.doctor_has_conflict(cid,current.doctor_location_id,occupied_start,occupied_end,aid)
 ) then return jsonb_build_object('ok',false,'conflicts',jsonb_build_array(jsonb_build_object('code','DOCTOR_CONFLICT'))); end if;
 for resource in select * from public.appointment_resources where clinic_id=cid and appointment_id=aid loop
  if resource.resource_kind='room' and (
   not private.resource_available(cid,'room',resource.room_id,occupied_start,occupied_end)
   or not private.resource_capacity_available(cid,'room',resource.room_id,resource.capacity_units,occupied_start,occupied_end,aid)
  ) then return jsonb_build_object('ok',false,'conflicts',jsonb_build_array(jsonb_build_object('code','ROOM_CONFLICT'))); end if;
  if resource.resource_kind='equipment' and (
   not private.resource_available(cid,'equipment',resource.equipment_id,occupied_start,occupied_end)
   or not private.resource_capacity_available(cid,'equipment',resource.equipment_id,resource.capacity_units,occupied_start,occupied_end,aid)
  ) then return jsonb_build_object('ok',false,'conflicts',jsonb_build_array(jsonb_build_object('code','EQUIPMENT_CONFLICT'))); end if;
 end loop;
 update public.appointments set end_at=new_end,occupied_start_at=occupied_start,occupied_end_at=occupied_end,duration_minutes=new_duration_minutes
 where id=aid returning * into changed;
 insert into public.appointment_history(organization_id,clinic_id,appointment_id,event,actor_id,old_values,new_values)
 values(current.organization_id,cid,aid,'RESIZED',auth.uid(),private.appointment_snapshot(current),private.appointment_snapshot(changed));
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata)
 values(current.organization_id,cid,auth.uid(),'update','appointments',aid,jsonb_build_object('fields',jsonb_build_array('duration_minutes'),'from',current.duration_minutes,'to',new_duration_minutes));
 return jsonb_build_object('ok',true,'appointment_id',aid,'updated_at',changed.updated_at,'duration_minutes',changed.duration_minutes,'end_at',changed.end_at);
end $$;

create or replace function public.public_available_slots(slug text,sid uuid,day date,doctor_id uuid default null,request_key text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare cid uuid; tz text; open_time time; close_time time; step_minutes integer; window_start timestamptz; window_end timestamptz; cursor_at timestamptz; resolved jsonb; slots jsonb='[]'; begin
 select id,timezone,calendar_visible_start,calendar_visible_end,scheduling_increment_minutes into cid,tz,open_time,close_time,step_minutes
 from public.clinics where booking_slug=slug and public_booking_enabled and archived_at is null;
 if cid is null or request_key !~ '^[a-f0-9]{64}$' then raise exception 'Invalid request'; end if;
 perform private.consume_public_rate('availability:clinic:'||cid,60,600);
 perform private.consume_public_rate('availability:key:'||cid||':'||request_key,60,60);
 if day<(now() at time zone tz)::date or day>(now() at time zone tz)::date+180 then raise exception 'Invalid date'; end if;
 if not exists(select 1 from public.services where id=sid and clinic_id=cid and active and archived_at is null) then raise exception 'Invalid service'; end if;
 if $4 is not null and not exists(select 1 from public.doctor_services ds join public.doctor_locations d on d.id=ds.doctor_location_id and d.clinic_id=ds.clinic_id where ds.clinic_id=cid and ds.service_id=sid and ds.doctor_location_id=$4 and d.active and d.archived_at is null) then raise exception 'Invalid doctor'; end if;
 window_start=(day+open_time) at time zone tz; window_end=(day+close_time) at time zone tz; cursor_at=window_start;
 while cursor_at<window_end loop
  resolved=private.resolve_assignment(cid,sid,cursor_at,$4,null,'{}',null);
  if (resolved->>'ok')::boolean and ((resolved->'assignment'->>'end_at')::timestamptz)<=window_end then
   slots=slots||jsonb_build_array(jsonb_build_object('start_at',cursor_at,'end_at',resolved->'assignment'->'end_at','doctor_id',resolved->'assignment'->'doctor_id'));
  end if;
  cursor_at=cursor_at+make_interval(mins=>step_minutes);
 end loop;
 return slots;
end $$;

revoke all on function public.get_reschedule_slots(uuid,uuid,timestamptz,timestamptz,uuid,integer),public.resize_appointment(uuid,uuid,integer,timestamptz) from public,anon;
grant execute on function public.get_reschedule_slots(uuid,uuid,timestamptz,timestamptz,uuid,integer),public.resize_appointment(uuid,uuid,integer,timestamptz) to authenticated;

