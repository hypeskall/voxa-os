-- All scheduling decisions are made in PostgreSQL. Mutation functions serialize
-- one clinic at a time, then repeat eligibility, availability and capacity checks
-- before writing. This keeps automatic assignment race-safe without trusting IDs
-- supplied by a browser or API client.

create function private.resource_available(
 cid uuid, resource_type text, resource_id uuid,
 range_start timestamptz, range_end timestamptz
) returns boolean language plpgsql stable security definer set search_path='' as $$
declare tz text; local_start timestamp; local_end timestamp; resource_active boolean; begin
 if range_end<=range_start or resource_type not in ('clinic','doctor','room','equipment') then return false; end if;
 select timezone into tz from public.clinics where id=cid and archived_at is null;
 if tz is null then return false; end if;
 if resource_type='clinic' then resource_active=resource_id=cid;
 elsif resource_type='doctor' then select active and archived_at is null into resource_active from public.doctor_locations where id=resource_id and clinic_id=cid;
 elsif resource_type='room' then select active and archived_at is null into resource_active from public.rooms where id=resource_id and clinic_id=cid;
 else select active and archived_at is null into resource_active from public.equipment where id=resource_id and clinic_id=cid;
 end if;
 if coalesce(resource_active,false)=false then return false; end if;
 local_start=range_start at time zone tz; local_end=range_end at time zone tz;
 -- Phase 2 recurrence rows are same-day intervals. Midnight at the following day
 -- is accepted as 24:00 for a rule ending at midnight only through extra work.
 if local_start::date<>local_end::date then
  if local_end::time<>time '00:00' or local_end::date<>local_start::date+1 then return false; end if;
 end if;
 if not (
  exists(select 1 from public.availability_rules a
   where a.clinic_id=cid and a.resource_kind=resource_type
    and coalesce(a.doctor_location_id,a.room_id,a.equipment_id,a.clinic_id)=resource_id
    and a.active and a.archived_at is null and a.interval_kind='work'
    and a.weekday=extract(isodow from local_start)::integer
    and local_start::date>=a.valid_from and (a.valid_until is null or local_start::date<=a.valid_until)
    and local_start::time>=a.start_time and local_end::date=local_start::date and local_end::time<=a.end_time)
  or exists(select 1 from public.schedule_exceptions e
   where e.clinic_id=cid and e.resource_kind=resource_type
    and coalesce(e.doctor_location_id,e.room_id,e.equipment_id,e.clinic_id)=resource_id
    and e.active and e.archived_at is null and e.exception_kind='extra_work'
    and e.starts_at<=range_start and e.ends_at>=range_end)
 ) then return false; end if;
 if exists(select 1 from public.availability_rules a
  where a.clinic_id=cid and a.resource_kind=resource_type
   and coalesce(a.doctor_location_id,a.room_id,a.equipment_id,a.clinic_id)=resource_id
   and a.active and a.archived_at is null and a.interval_kind='break'
   and a.weekday=extract(isodow from local_start)::integer
   and local_start::date>=a.valid_from and (a.valid_until is null or local_start::date<=a.valid_until)
   and a.start_time<local_end::time and a.end_time>local_start::time) then return false; end if;
 if exists(select 1 from public.schedule_exceptions e
  where e.clinic_id=cid and e.resource_kind=resource_type
   and coalesce(e.doctor_location_id,e.room_id,e.equipment_id,e.clinic_id)=resource_id
   and e.active and e.archived_at is null and e.exception_kind<>'extra_work'
   and e.starts_at<range_end and e.ends_at>range_start) then return false; end if;
 return true;
end $$;

create function private.doctor_has_conflict(
 cid uuid,did uuid,range_start timestamptz,range_end timestamptz,excluded uuid default null
) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.appointments a where a.clinic_id=cid
  and a.doctor_location_id=did and a.status<>'CANCELLED' and a.id<>coalesce(excluded,'00000000-0000-0000-0000-000000000000'::uuid)
  and a.occupied_start_at<range_end and a.occupied_end_at>range_start)
$$;

create function private.resource_capacity_available(
 cid uuid,kind text,rid uuid,units integer,range_start timestamptz,range_end timestamptz,excluded uuid default null
) returns boolean language plpgsql stable security definer set search_path='' as $$
declare maximum integer; used integer; begin
 if kind='room' then select capacity into maximum from public.rooms where id=rid and clinic_id=cid and active and archived_at is null;
 elsif kind='equipment' then select capacity into maximum from public.equipment where id=rid and clinic_id=cid and active and archived_at is null;
 else return false; end if;
 if maximum is null or units>maximum then return false; end if;
 select coalesce(sum(ar.capacity_units),0) into used
 from public.appointment_resources ar join public.appointments a on a.id=ar.appointment_id and a.clinic_id=ar.clinic_id
 where ar.clinic_id=cid and ar.resource_kind=kind
  and coalesce(ar.room_id,ar.equipment_id)=rid and a.status<>'CANCELLED'
  and a.id<>coalesce(excluded,'00000000-0000-0000-0000-000000000000'::uuid)
  and a.occupied_start_at<range_end and a.occupied_end_at>range_start;
 return used+units<=maximum;
end $$;

create function private.resolve_equipment(
 cid uuid,sid uuid,assigned_room uuid,requested uuid[],range_start timestamptz,range_end timestamptz,excluded uuid default null
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare req record; chosen record; result jsonb='[]'; requested_count integer; invalid uuid; begin
 select x into invalid from unnest(coalesce(requested,'{}'::uuid[])) x
 where not exists(select 1 from public.service_equipment se where se.clinic_id=cid and se.service_id=sid and se.equipment_id=x) limit 1;
 if invalid is not null then return jsonb_build_object('ok',false,'code','EQUIPMENT_INELIGIBLE','resource_id',invalid); end if;
 for req in select requirement_group,max(quantity)::integer units,max(minimum_capacity)::integer minimum_capacity
  from public.service_equipment where clinic_id=cid and service_id=sid group by requirement_group order by requirement_group loop
  select count(*) into requested_count from public.service_equipment se
   where se.clinic_id=cid and se.service_id=sid and se.requirement_group=req.requirement_group
    and se.equipment_id=any(coalesce(requested,'{}'::uuid[]));
  if requested_count>1 then return jsonb_build_object('ok',false,'code','MULTIPLE_EQUIPMENT_FOR_REQUIREMENT','requirement_group',req.requirement_group); end if;
  chosen=null;
  select e.id,se.quantity,se.requirement_group into chosen
  from public.service_equipment se join public.equipment e on e.id=se.equipment_id and e.clinic_id=se.clinic_id
  where se.clinic_id=cid and se.service_id=sid and se.requirement_group=req.requirement_group
   and e.active and e.archived_at is null and e.capacity>=greatest(se.quantity,se.minimum_capacity)
   and (e.room_id is null or assigned_room is null or e.room_id=assigned_room)
   and (requested_count=0 or e.id=any(requested))
   and private.resource_available(cid,'equipment',e.id,range_start,range_end)
   and private.resource_capacity_available(cid,'equipment',e.id,se.quantity,range_start,range_end,excluded)
  order by case when e.id=any(coalesce(requested,'{}'::uuid[])) then 0 else 1 end,e.id limit 1;
  if chosen.id is null then return jsonb_build_object('ok',false,'code','EQUIPMENT_CONFLICT','requirement_group',req.requirement_group); end if;
  result=result||jsonb_build_array(jsonb_build_object('id',chosen.id,'capacity_units',chosen.quantity,'requirement_group',chosen.requirement_group));
 end loop;
 return jsonb_build_object('ok',true,'equipment',result);
end $$;

create function private.resolve_assignment(
 cid uuid,sid uuid,starts timestamptz,requested_doctor uuid default null,
 requested_room uuid default null,requested_equipment uuid[] default '{}',excluded uuid default null
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare svc public.services; finishes timestamptz; occupied_start timestamptz; occupied_end timestamptz;
 chosen_doctor uuid; chosen_room uuid; room_candidate record; equipment_result jsonb; conflicts jsonb='[]'; begin
 select * into svc from public.services where id=sid and clinic_id=cid and active and archived_at is null;
 if svc.id is null then return jsonb_build_object('ok',false,'conflicts',jsonb_build_array(jsonb_build_object('code','SERVICE_UNAVAILABLE'))); end if;
 finishes=starts+make_interval(mins=>svc.duration_minutes);
 occupied_start=starts-make_interval(mins=>svc.buffer_before);
 occupied_end=finishes+make_interval(mins=>svc.buffer_after);
 if starts<now()-interval '1 minute' then conflicts=conflicts||jsonb_build_array(jsonb_build_object('code','START_IN_PAST')); end if;
 if not private.resource_available(cid,'clinic',cid,occupied_start,occupied_end) then
  if exists(select 1 from public.schedule_exceptions e where e.clinic_id=cid and e.resource_kind='clinic' and e.active and e.archived_at is null and e.exception_kind<>'extra_work' and e.starts_at<occupied_end and e.ends_at>occupied_start) then
   conflicts=conflicts||jsonb_build_array(jsonb_build_object('code','BLOCKED_PERIOD','resource_kind','clinic','resource_id',cid));
  else
   conflicts=conflicts||jsonb_build_array(jsonb_build_object('code','OUTSIDE_WORKING_HOURS','resource_kind','clinic','resource_id',cid));
  end if;
 end if;

 if svc.doctor_requirement='none' and requested_doctor is not null then
  conflicts=conflicts||jsonb_build_array(jsonb_build_object('code','DOCTOR_NOT_ALLOWED','resource_id',requested_doctor));
 elsif requested_doctor is not null then
  if not exists(select 1 from public.doctor_services ds join public.doctor_locations d on d.id=ds.doctor_location_id and d.clinic_id=ds.clinic_id
    where ds.clinic_id=cid and ds.service_id=sid and ds.doctor_location_id=requested_doctor and d.active and d.archived_at is null) then
   conflicts=conflicts||jsonb_build_array(jsonb_build_object('code','DOCTOR_INELIGIBLE','resource_id',requested_doctor));
  elsif not private.resource_available(cid,'doctor',requested_doctor,occupied_start,occupied_end) then
   conflicts=conflicts||jsonb_build_array(jsonb_build_object('code','DOCTOR_UNAVAILABLE','resource_id',requested_doctor));
  elsif private.doctor_has_conflict(cid,requested_doctor,occupied_start,occupied_end,excluded) then
   conflicts=conflicts||jsonb_build_array(jsonb_build_object('code','DOCTOR_CONFLICT','resource_id',requested_doctor));
  else chosen_doctor=requested_doctor; end if;
 elsif svc.doctor_requirement='required' then
  select d.id into chosen_doctor from public.doctor_services ds join public.doctor_locations d on d.id=ds.doctor_location_id and d.clinic_id=ds.clinic_id
   where ds.clinic_id=cid and ds.service_id=sid and d.active and d.archived_at is null
    and private.resource_available(cid,'doctor',d.id,occupied_start,occupied_end)
    and not private.doctor_has_conflict(cid,d.id,occupied_start,occupied_end,excluded)
   order by d.id limit 1;
  if chosen_doctor is null then conflicts=conflicts||jsonb_build_array(jsonb_build_object('code','NO_AVAILABLE_DOCTOR')); end if;
 end if;

 if requested_room is not null then
  if not exists(select 1 from public.service_rooms sr join public.rooms r on r.id=sr.room_id and r.clinic_id=sr.clinic_id
   where sr.clinic_id=cid and sr.service_id=sid and sr.room_id=requested_room and r.active and r.archived_at is null and r.capacity>=svc.minimum_room_capacity) then
   conflicts=conflicts||jsonb_build_array(jsonb_build_object('code','ROOM_INELIGIBLE','resource_id',requested_room));
  elsif not private.resource_available(cid,'room',requested_room,occupied_start,occupied_end) then
   conflicts=conflicts||jsonb_build_array(jsonb_build_object('code','ROOM_UNAVAILABLE','resource_id',requested_room));
  elsif not private.resource_capacity_available(cid,'room',requested_room,svc.minimum_room_capacity,occupied_start,occupied_end,excluded) then
   conflicts=conflicts||jsonb_build_array(jsonb_build_object('code',case when (select capacity from public.rooms where id=requested_room)=1 then 'ROOM_CONFLICT' else 'CAPACITY_EXCEEDED' end,'resource_id',requested_room));
  else
   chosen_room=requested_room;
   equipment_result=private.resolve_equipment(cid,sid,chosen_room,requested_equipment,occupied_start,occupied_end,excluded);
   if not (equipment_result->>'ok')::boolean then conflicts=conflicts||jsonb_build_array(equipment_result-'ok'); end if;
  end if;
 elsif svc.room_required then
  for room_candidate in select r.id from public.service_rooms sr join public.rooms r on r.id=sr.room_id and r.clinic_id=sr.clinic_id
   where sr.clinic_id=cid and sr.service_id=sid and r.active and r.archived_at is null and r.capacity>=svc.minimum_room_capacity
    and private.resource_available(cid,'room',r.id,occupied_start,occupied_end)
    and private.resource_capacity_available(cid,'room',r.id,svc.minimum_room_capacity,occupied_start,occupied_end,excluded)
   order by case when chosen_doctor is not null and exists(select 1 from public.doctor_rooms dr where dr.clinic_id=cid and dr.doctor_location_id=chosen_doctor and dr.room_id=r.id) then 0 else 1 end,r.id loop
    equipment_result=private.resolve_equipment(cid,sid,room_candidate.id,requested_equipment,occupied_start,occupied_end,excluded);
    if (equipment_result->>'ok')::boolean then chosen_room=room_candidate.id; exit; end if;
  end loop;
  if chosen_room is null then conflicts=conflicts||jsonb_build_array(jsonb_build_object('code','NO_AVAILABLE_RESOURCE_COMBINATION')); end if;
 else
  equipment_result=private.resolve_equipment(cid,sid,null,requested_equipment,occupied_start,occupied_end,excluded);
  if not (equipment_result->>'ok')::boolean then conflicts=conflicts||jsonb_build_array(equipment_result-'ok'); end if;
 end if;
 if jsonb_array_length(conflicts)>0 then return jsonb_build_object('ok',false,'conflicts',conflicts); end if;
 if equipment_result is null then equipment_result=private.resolve_equipment(cid,sid,chosen_room,requested_equipment,occupied_start,occupied_end,excluded); end if;
 return jsonb_build_object('ok',true,'assignment',jsonb_build_object(
  'doctor_id',chosen_doctor,'room_id',chosen_room,'equipment',equipment_result->'equipment',
  'start_at',starts,'end_at',finishes,'occupied_start_at',occupied_start,'occupied_end_at',occupied_end,
  'duration_minutes',svc.duration_minutes,'buffer_before',svc.buffer_before,'buffer_after',svc.buffer_after));
end $$;

create function private.appointment_snapshot(a public.appointments) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object('start_at',a.start_at,'end_at',a.end_at,'doctor_id',a.doctor_location_id,
  'status',a.status,'source',a.source,'updated_at',a.updated_at)
$$;

create function private.appointment_resource_snapshot(cid uuid,aid uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'room_id',(select room_id from public.appointment_resources where clinic_id=cid and appointment_id=aid and resource_kind='room' limit 1),
  'equipment',coalesce((select jsonb_agg(jsonb_build_object('id',equipment_id,'capacity_units',capacity_units,'requirement_group',requirement_group) order by equipment_id)
   from public.appointment_resources where clinic_id=cid and appointment_id=aid and resource_kind='equipment'),'[]'::jsonb))
$$;

create function private.duplicate_warnings(cid uuid,pid uuid,sid uuid,starts timestamptz,excluded uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('code','POSSIBLE_DUPLICATE','appointment_id',a.id,'start_at',a.start_at)),'[]'::jsonb)
 from public.appointments a where a.clinic_id=cid and a.patient_id=pid and a.service_id=sid and a.status<>'CANCELLED'
  and a.id<>coalesce(excluded,'00000000-0000-0000-0000-000000000000'::uuid)
  and a.start_at between starts-interval '24 hours' and starts+interval '24 hours'
$$;

create function private.write_resources(cid uuid,oid uuid,aid uuid,assignment jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare item jsonb; begin
 if assignment->>'room_id' is not null then
  insert into public.appointment_resources(organization_id,clinic_id,appointment_id,resource_kind,room_id,capacity_units)
  values(oid,cid,aid,'room',(assignment->>'room_id')::uuid,(select minimum_room_capacity from public.services where id=(select service_id from public.appointments where id=aid)));
 end if;
 for item in select value from jsonb_array_elements(coalesce(assignment->'equipment','[]')) loop
  insert into public.appointment_resources(organization_id,clinic_id,appointment_id,resource_kind,equipment_id,capacity_units,requirement_group)
  values(oid,cid,aid,'equipment',(item->>'id')::uuid,(item->>'capacity_units')::integer,(item->>'requirement_group')::uuid);
 end loop;
end $$;

create function public.get_required_resources(cid uuid,sid uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare svc public.services; begin
 if not private.has_permission(cid,'appointments.read') then raise exception 'Access denied' using errcode='42501'; end if;
 select * into svc from public.services where id=sid and clinic_id=cid and active and archived_at is null;
 if svc.id is null then raise exception 'Service unavailable'; end if;
 return jsonb_build_object('doctor_requirement',svc.doctor_requirement,'room_required',svc.room_required,
  'minimum_room_capacity',svc.minimum_room_capacity,'duration_minutes',svc.duration_minutes,
  'buffer_before',svc.buffer_before,'buffer_after',svc.buffer_after,
  'equipment_requirements',coalesce((select jsonb_agg(x order by x->>'requirement_group') from (
   select jsonb_build_object('requirement_group',se.requirement_group,'quantity',max(se.quantity),'minimum_capacity',max(se.minimum_capacity),
    'eligible_equipment',jsonb_agg(se.equipment_id order by se.equipment_id)) x
   from public.service_equipment se where se.clinic_id=cid and se.service_id=sid group by se.requirement_group) q),'[]'));
end $$;

create function public.find_available_resources(cid uuid,sid uuid,starts timestamptz,doctor_id uuid default null,room_id uuid default null,equipment_ids uuid[] default '{}',excluded_appointment uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$ begin
 if not private.has_permission(cid,'appointments.read') then raise exception 'Access denied' using errcode='42501'; end if;
 return private.resolve_assignment(cid,sid,starts,doctor_id,room_id,equipment_ids,excluded_appointment);
end $$;

create function public.validate_appointment(cid uuid,payload jsonb,excluded_appointment uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; warnings jsonb; pid uuid; sid uuid; starts timestamptz; equipment_ids uuid[]; begin
 if not private.has_permission(cid,'appointments.read') or jsonb_typeof(payload)<>'object' then raise exception 'Access denied' using errcode='42501'; end if;
 pid=(payload->>'patient_id')::uuid; sid=(payload->>'service_id')::uuid; starts=(payload->>'start_at')::timestamptz;
 select coalesce(array_agg(x::uuid),'{}') into equipment_ids from jsonb_array_elements_text(coalesce(payload->'equipment_ids','[]')) x;
 if not exists(select 1 from public.patients where id=pid and clinic_id=cid and active and archived_at is null) then
  return jsonb_build_object('ok',false,'conflicts',jsonb_build_array(jsonb_build_object('code','PATIENT_UNAVAILABLE')),'warnings','[]'::jsonb);
 end if;
 result=private.resolve_assignment(cid,sid,starts,nullif(payload->>'doctor_id','')::uuid,nullif(payload->>'room_id','')::uuid,equipment_ids,excluded_appointment);
 warnings=private.duplicate_warnings(cid,pid,sid,starts,excluded_appointment);
 return result||jsonb_build_object('warnings',warnings,'requires_override',jsonb_array_length(warnings)>0);
end $$;

create function public.find_conflicts(cid uuid,payload jsonb,excluded_appointment uuid default null) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(public.validate_appointment(cid,payload,excluded_appointment)->'conflicts','[]'::jsonb)
$$;

create function public.create_appointment(cid uuid,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare oid uuid; aid uuid=gen_random_uuid(); pid uuid; sid uuid; starts timestamptz; source_value public.appointment_source; initial_status public.appointment_status;
 equipment_ids uuid[]; checked jsonb; assignment jsonb; warnings jsonb; override_warning boolean; created public.appointments; begin
 if not private.has_permission(cid,'appointments.manage') or jsonb_typeof(payload)<>'object' then raise exception 'Access denied' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(cid::text,21));
 select organization_id into oid from public.clinics where id=cid and archived_at is null;
 pid=(payload->>'patient_id')::uuid; sid=(payload->>'service_id')::uuid; starts=(payload->>'start_at')::timestamptz;
 if oid is null or not exists(select 1 from public.patients where id=pid and clinic_id=cid and active and archived_at is null) then raise exception 'Patient unavailable'; end if;
 select coalesce(array_agg(x::uuid),'{}') into equipment_ids from jsonb_array_elements_text(coalesce(payload->'equipment_ids','[]')) x;
 assignment=private.resolve_assignment(cid,sid,starts,nullif(payload->>'doctor_id','')::uuid,nullif(payload->>'room_id','')::uuid,equipment_ids,null);
 if not (assignment->>'ok')::boolean then return assignment||jsonb_build_object('warnings','[]'::jsonb); end if;
 warnings=private.duplicate_warnings(cid,pid,sid,starts,null);
 override_warning=coalesce((payload->>'override_duplicate')::boolean,false);
 if jsonb_array_length(warnings)>0 and not override_warning then
  return jsonb_build_object('ok',false,'conflicts','[]'::jsonb,'warnings',warnings,'requires_override',true);
 end if;
 if override_warning and jsonb_array_length(warnings)>0 and not private.has_permission(cid,'appointments.override') then raise exception 'Override access denied' using errcode='42501'; end if;
 if override_warning and jsonb_array_length(warnings)>0 and length(trim(coalesce(payload->>'override_reason','')))<3 then raise exception 'Override reason required'; end if;
 checked=assignment->'assignment'; source_value=coalesce((payload->>'source')::public.appointment_source,'RECEPTION'); initial_status=coalesce((payload->>'status')::public.appointment_status,'PENDING');
 if initial_status not in ('PENDING','CONFIRMED') then raise exception 'Invalid initial status'; end if;
 insert into public.appointments(id,organization_id,clinic_id,patient_id,service_id,doctor_location_id,start_at,end_at,occupied_start_at,occupied_end_at,duration_minutes,buffer_before,buffer_after,status,source,notes,created_by)
 values(aid,oid,cid,pid,sid,nullif(checked->>'doctor_id','')::uuid,(checked->>'start_at')::timestamptz,(checked->>'end_at')::timestamptz,
  (checked->>'occupied_start_at')::timestamptz,(checked->>'occupied_end_at')::timestamptz,(checked->>'duration_minutes')::integer,
  (checked->>'buffer_before')::integer,(checked->>'buffer_after')::integer,initial_status,source_value,
  coalesce(payload->>'notes',''),auth.uid()) returning * into created;
 perform private.write_resources(cid,oid,aid,checked);
 insert into public.appointment_history(organization_id,clinic_id,appointment_id,event,actor_id,new_values)
 values(oid,cid,aid,'CREATED',auth.uid(),private.appointment_snapshot(created));
 insert into public.appointment_history(organization_id,clinic_id,appointment_id,event,actor_id,new_values)
 values(oid,cid,aid,'RESOURCES_ASSIGNED',auth.uid(),jsonb_build_object('doctor_id',checked->'doctor_id','room_id',checked->'room_id','equipment',checked->'equipment'));
 if override_warning and jsonb_array_length(warnings)>0 then
  insert into public.appointment_history(organization_id,clinic_id,appointment_id,event,actor_id,new_values,reason)
  values(oid,cid,aid,'DUPLICATE_OVERRIDE',auth.uid(),jsonb_build_object('warnings',warnings),left(coalesce(payload->>'override_reason',''),1000));
 end if;
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata)
 values(oid,cid,auth.uid(),'create','appointments',aid,jsonb_build_object('source',source_value,'duplicate_override',override_warning and jsonb_array_length(warnings)>0));
 return jsonb_build_object('ok',true,'appointment_id',aid,'assignment',checked,'warnings',warnings,'updated_at',created.updated_at);
end $$;

create function public.reschedule_appointment(cid uuid,aid uuid,payload jsonb,expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current public.appointments; previous jsonb; old_resources jsonb; new_resources jsonb; assignment jsonb; checked jsonb; warnings jsonb; equipment_ids uuid[]; override_warning boolean; changed public.appointments; begin
 if not private.has_permission(cid,'appointments.manage') or jsonb_typeof(payload)<>'object' then raise exception 'Access denied' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(cid::text,21));
 select * into current from public.appointments where id=aid and clinic_id=cid for update;
 if current.id is null then raise exception 'Appointment unavailable'; end if;
 if expected_updated_at is null or current.updated_at<>expected_updated_at then raise exception 'Stale version' using errcode='40001'; end if;
 if current.status in ('CANCELLED','COMPLETED','NO_SHOW') then raise exception 'Appointment cannot be rescheduled'; end if;
 previous=private.appointment_snapshot(current); old_resources=private.appointment_resource_snapshot(cid,aid)||jsonb_build_object('doctor_id',current.doctor_location_id);
 select coalesce(array_agg(x::uuid),'{}') into equipment_ids from jsonb_array_elements_text(coalesce(payload->'equipment_ids','[]')) x;
 assignment=private.resolve_assignment(cid,current.service_id,(payload->>'start_at')::timestamptz,nullif(payload->>'doctor_id','')::uuid,nullif(payload->>'room_id','')::uuid,equipment_ids,aid);
 if not (assignment->>'ok')::boolean then return assignment||jsonb_build_object('warnings','[]'::jsonb); end if;
 warnings=private.duplicate_warnings(cid,current.patient_id,current.service_id,(payload->>'start_at')::timestamptz,aid);
 override_warning=coalesce((payload->>'override_duplicate')::boolean,false);
 if jsonb_array_length(warnings)>0 and not override_warning then return jsonb_build_object('ok',false,'conflicts','[]'::jsonb,'warnings',warnings,'requires_override',true); end if;
 if override_warning and jsonb_array_length(warnings)>0 and not private.has_permission(cid,'appointments.override') then raise exception 'Override access denied' using errcode='42501'; end if;
 if override_warning and jsonb_array_length(warnings)>0 and length(trim(coalesce(payload->>'override_reason','')))<3 then raise exception 'Override reason required'; end if;
 checked=assignment->'assignment';
 delete from public.appointment_resources where appointment_id=aid and clinic_id=cid;
 update public.appointments set doctor_location_id=nullif(checked->>'doctor_id','')::uuid,start_at=(checked->>'start_at')::timestamptz,
  end_at=(checked->>'end_at')::timestamptz,occupied_start_at=(checked->>'occupied_start_at')::timestamptz,occupied_end_at=(checked->>'occupied_end_at')::timestamptz,
  duration_minutes=(checked->>'duration_minutes')::integer,buffer_before=(checked->>'buffer_before')::integer,buffer_after=(checked->>'buffer_after')::integer
 where id=aid returning * into changed;
 perform private.write_resources(cid,current.organization_id,aid,checked);
 new_resources=private.appointment_resource_snapshot(cid,aid)||jsonb_build_object('doctor_id',changed.doctor_location_id);
 insert into public.appointment_history(organization_id,clinic_id,appointment_id,event,actor_id,old_values,new_values)
 values(current.organization_id,cid,aid,'RESCHEDULED',auth.uid(),previous,private.appointment_snapshot(changed));
 if old_resources is distinct from new_resources then
  insert into public.appointment_history(organization_id,clinic_id,appointment_id,event,actor_id,old_values,new_values)
  values(current.organization_id,cid,aid,'RESOURCES_ASSIGNED',auth.uid(),old_resources,new_resources);
 end if;
 if override_warning and jsonb_array_length(warnings)>0 then
  insert into public.appointment_history(organization_id,clinic_id,appointment_id,event,actor_id,new_values,reason)
  values(current.organization_id,cid,aid,'DUPLICATE_OVERRIDE',auth.uid(),jsonb_build_object('warnings',warnings),left(coalesce(payload->>'override_reason',''),1000));
 end if;
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata)
 values(current.organization_id,cid,auth.uid(),'reschedule','appointments',aid,jsonb_build_object('duplicate_override',override_warning and jsonb_array_length(warnings)>0));
 return jsonb_build_object('ok',true,'appointment_id',aid,'assignment',checked,'warnings',warnings,'updated_at',changed.updated_at);
end $$;

create function public.cancel_appointment(cid uuid,aid uuid,reason text,expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current public.appointments; changed public.appointments; begin
 if not private.has_permission(cid,'appointments.manage') then raise exception 'Access denied' using errcode='42501'; end if;
 if length(coalesce(reason,''))>1000 then raise exception 'Invalid reason'; end if;
 perform pg_advisory_xact_lock(hashtextextended(cid::text,21));
 select * into current from public.appointments where id=aid and clinic_id=cid for update;
 if current.id is null then raise exception 'Appointment unavailable'; end if;
 if expected_updated_at is null or current.updated_at<>expected_updated_at then raise exception 'Stale version' using errcode='40001'; end if;
 if current.status='CANCELLED' then return jsonb_build_object('ok',true,'appointment_id',aid,'updated_at',current.updated_at); end if;
 if current.status in ('COMPLETED','NO_SHOW') then raise exception 'Appointment cannot be cancelled'; end if;
 update public.appointments set status='CANCELLED',cancelled_at=now(),cancellation_reason=coalesce(reason,'') where id=aid returning * into changed;
 insert into public.appointment_history(organization_id,clinic_id,appointment_id,event,actor_id,old_values,new_values,reason)
 values(current.organization_id,cid,aid,'CANCELLED',auth.uid(),private.appointment_snapshot(current),private.appointment_snapshot(changed),coalesce(reason,''));
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata)
 values(current.organization_id,cid,auth.uid(),'cancel','appointments',aid,jsonb_build_object('previous_status',current.status));
 return jsonb_build_object('ok',true,'appointment_id',aid,'updated_at',changed.updated_at);
end $$;

create function public.set_appointment_status(cid uuid,aid uuid,next_status public.appointment_status,expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current public.appointments; changed public.appointments; allowed boolean; begin
 if not private.has_permission(cid,'appointments.manage') then raise exception 'Access denied' using errcode='42501'; end if;
 if next_status='CANCELLED' then raise exception 'Use cancel_appointment'; end if;
 perform pg_advisory_xact_lock(hashtextextended(cid::text,21));
 select * into current from public.appointments where id=aid and clinic_id=cid for update;
 if current.id is null then raise exception 'Appointment unavailable'; end if;
 if expected_updated_at is null or current.updated_at<>expected_updated_at then raise exception 'Stale version' using errcode='40001'; end if;
 allowed=(current.status='PENDING' and next_status='CONFIRMED') or
  (current.status='CONFIRMED' and next_status in ('ARRIVED','NO_SHOW')) or
  (current.status='ARRIVED' and next_status in ('IN_PROGRESS','NO_SHOW')) or
  (current.status='IN_PROGRESS' and next_status='COMPLETED');
 if not allowed then raise exception 'Invalid status transition'; end if;
 update public.appointments set status=next_status where id=aid returning * into changed;
 insert into public.appointment_history(organization_id,clinic_id,appointment_id,event,actor_id,old_values,new_values)
 values(current.organization_id,cid,aid,'STATUS_CHANGED',auth.uid(),private.appointment_snapshot(current),private.appointment_snapshot(changed));
 return jsonb_build_object('ok',true,'appointment_id',aid,'updated_at',changed.updated_at,'status',changed.status);
end $$;

create function public.get_available_slots(cid uuid,sid uuid,window_start timestamptz,window_end timestamptz,doctor_id uuid default null,step_minutes integer default 15)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare cursor_at timestamptz; resolved jsonb; slots jsonb='[]'; begin
 if not private.has_permission(cid,'appointments.read') then raise exception 'Access denied' using errcode='42501'; end if;
 if window_end<=window_start or window_end>window_start+interval '31 days' or step_minutes not between 5 and 120 then raise exception 'Invalid slot window'; end if;
 cursor_at=window_start;
 while cursor_at<window_end loop
  resolved=private.resolve_assignment(cid,sid,cursor_at,doctor_id,null,'{}',null);
  if (resolved->>'ok')::boolean and ((resolved->'assignment'->>'end_at')::timestamptz)<=window_end then
   slots=slots||jsonb_build_array(jsonb_build_object('start_at',cursor_at,'end_at',resolved->'assignment'->'end_at','assignment',resolved->'assignment'));
  end if;
  cursor_at=cursor_at+make_interval(mins=>step_minutes);
 end loop;
 return slots;
end $$;

revoke all on function private.resource_available(uuid,text,uuid,timestamptz,timestamptz),
 private.doctor_has_conflict(uuid,uuid,timestamptz,timestamptz,uuid),
 private.resource_capacity_available(uuid,text,uuid,integer,timestamptz,timestamptz,uuid),
 private.resolve_equipment(uuid,uuid,uuid,uuid[],timestamptz,timestamptz,uuid),
 private.resolve_assignment(uuid,uuid,timestamptz,uuid,uuid,uuid[],uuid),
 private.appointment_snapshot(public.appointments),private.appointment_resource_snapshot(uuid,uuid),private.duplicate_warnings(uuid,uuid,uuid,timestamptz,uuid),
 private.write_resources(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.get_required_resources(uuid,uuid),public.find_available_resources(uuid,uuid,timestamptz,uuid,uuid,uuid[],uuid),
 public.validate_appointment(uuid,jsonb,uuid),public.find_conflicts(uuid,jsonb,uuid),public.create_appointment(uuid,jsonb),
 public.reschedule_appointment(uuid,uuid,jsonb,timestamptz),public.cancel_appointment(uuid,uuid,text,timestamptz),
 public.set_appointment_status(uuid,uuid,public.appointment_status,timestamptz),public.get_available_slots(uuid,uuid,timestamptz,timestamptz,uuid,integer)
 from public,anon;
grant execute on function public.get_required_resources(uuid,uuid),public.find_available_resources(uuid,uuid,timestamptz,uuid,uuid,uuid[],uuid),
 public.validate_appointment(uuid,jsonb,uuid),public.find_conflicts(uuid,jsonb,uuid),public.create_appointment(uuid,jsonb),
 public.reschedule_appointment(uuid,uuid,jsonb,timestamptz),public.cancel_appointment(uuid,uuid,text,timestamptz),
 public.set_appointment_status(uuid,uuid,public.appointment_status,timestamptz),public.get_available_slots(uuid,uuid,timestamptz,timestamptz,uuid,integer)
 to authenticated;
