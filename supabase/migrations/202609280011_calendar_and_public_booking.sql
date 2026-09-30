-- Phase 4 surfaces the Phase 3 engine through bounded internal calendar reads
-- and deliberately narrow anonymous booking workflows.
alter table public.clinics
 add column public_booking_enabled boolean not null default false,
 add column booking_slug text unique check(booking_slug is null or booking_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');
alter table public.user_preferences
 add column calendar_view text not null default 'week' check(calendar_view in ('day','week','month','agenda')),
 add column calendar_filters jsonb not null default '{}'
  check(jsonb_typeof(calendar_filters)='object' and pg_column_size(calendar_filters)<=4096);
alter table public.appointments alter column created_by drop not null;
alter table public.appointment_history alter column actor_id drop not null;
alter table public.appointment_history drop constraint appointment_history_event_check;
alter table public.appointment_history add constraint appointment_history_event_check check(event in (
 'CREATED','UPDATED','RESCHEDULED','CANCELLED','STATUS_CHANGED',
 'RESOURCES_ASSIGNED','DUPLICATE_OVERRIDE'
));
grant update(public_booking_enabled,booking_slug) on public.clinics to authenticated;
grant insert(user_id,default_clinic_id,density,calendar_view,calendar_filters),
 update(default_clinic_id,density,calendar_view,calendar_filters) on public.user_preferences to authenticated;

create table private.public_booking_rate_limits (
 scope_key text not null,
 bucket_start timestamptz not null,
 hits integer not null default 1,
 primary key(scope_key,bucket_start)
);

create function private.consume_public_rate(rate_scope text,window_seconds integer,maximum integer)
returns void language plpgsql security definer set search_path='' as $$
declare bucket timestamptz; current_hits integer; begin
 if length(rate_scope)>200 or window_seconds not between 10 and 86400 or maximum not between 1 and 10000 then raise exception 'Invalid rate limit'; end if;
 bucket=to_timestamp(floor(extract(epoch from now())/window_seconds)*window_seconds);
 perform pg_advisory_xact_lock(hashtextextended(rate_scope,41));
 insert into private.public_booking_rate_limits(scope_key,bucket_start,hits) values(rate_scope,bucket,1)
 on conflict(scope_key,bucket_start) do update set hits=private.public_booking_rate_limits.hits+1 returning hits into current_hits;
 if current_hits>maximum then raise exception 'Rate limit exceeded' using errcode='P0001'; end if;
 if random()<0.01 then delete from private.public_booking_rate_limits where bucket_start<now()-interval '2 days'; end if;
end $$;

create function public.list_calendar_appointments(cid uuid,range_start timestamptz,range_end timestamptz,filters jsonb default '{}')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; begin
 if not private.has_permission(cid,'appointments.read') then raise exception 'Access denied' using errcode='42501'; end if;
 if range_end<=range_start or range_end>range_start+interval '62 days' or jsonb_typeof(filters)<>'object' or pg_column_size(filters)>4096 then raise exception 'Invalid calendar range'; end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.start_at,x.id),'[]') into result from (
  select a.id,a.patient_id,a.service_id,a.doctor_location_id,a.start_at,a.end_at,a.status,a.source,a.notes,a.updated_at,
   p.name patient_name,p.phone patient_phone,p.email patient_email,s.name service_name,
   d.name doctor_name,rr.room_id,rr.room_name,coalesce(rr.equipment,'[]'::jsonb) equipment
  from public.appointments a
  join public.patients p on p.id=a.patient_id and p.clinic_id=a.clinic_id
  join public.services s on s.id=a.service_id and s.clinic_id=a.clinic_id
  left join public.clinic_doctors d on d.id=a.doctor_location_id and d.clinic_id=a.clinic_id
  left join lateral (
   select max(ar.room_id::text)::uuid room_id,max(r.name) room_name,
    coalesce(jsonb_agg(jsonb_build_object('id',e.id,'name',e.name) order by e.name) filter(where e.id is not null),'[]') equipment
   from public.appointment_resources ar
   left join public.rooms r on r.id=ar.room_id and r.clinic_id=ar.clinic_id
   left join public.equipment e on e.id=ar.equipment_id and e.clinic_id=ar.clinic_id
   where ar.appointment_id=a.id and ar.clinic_id=a.clinic_id
  ) rr on true
  where a.clinic_id=cid and a.start_at<range_end and a.end_at>range_start
   and (coalesce(filters->>'doctor_id','')='' or a.doctor_location_id=(filters->>'doctor_id')::uuid)
   and (coalesce(filters->>'service_id','')='' or a.service_id=(filters->>'service_id')::uuid)
   and (coalesce(filters->>'room_id','')='' or exists(select 1 from public.appointment_resources ar where ar.appointment_id=a.id and ar.clinic_id=cid and ar.room_id=(filters->>'room_id')::uuid))
   and (coalesce(filters->>'equipment_id','')='' or exists(select 1 from public.appointment_resources ar where ar.appointment_id=a.id and ar.clinic_id=cid and ar.equipment_id=(filters->>'equipment_id')::uuid))
   and (coalesce(filters->>'speciality_id','')='' or exists(select 1 from public.doctor_specialities ds where ds.clinic_id=cid and ds.doctor_location_id=a.doctor_location_id and ds.speciality_id=(filters->>'speciality_id')::uuid))
   and (coalesce(filters->>'status','')='' or a.status::text=filters->>'status')
 ) x;
 return result;
end $$;

create function public.read_appointment(cid uuid,aid uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare item jsonb; begin
 if not private.has_permission(cid,'appointments.read') then raise exception 'Access denied' using errcode='42501'; end if;
 select to_jsonb(x) into item from (
  select a.*,p.name patient_name,p.phone patient_phone,p.email patient_email,p.internal_id patient_internal_id,
   s.name service_name,d.name doctor_name,
   coalesce((select jsonb_agg(jsonb_build_object('kind',ar.resource_kind,'id',coalesce(ar.room_id,ar.equipment_id),'name',coalesce(r.name,e.name)) order by ar.resource_kind,coalesce(r.name,e.name))
    from public.appointment_resources ar left join public.rooms r on r.id=ar.room_id left join public.equipment e on e.id=ar.equipment_id
    where ar.clinic_id=cid and ar.appointment_id=aid),'[]') resources,
   coalesce((select jsonb_agg(jsonb_build_object('event',h.event,'actor_id',h.actor_id,'old_values',h.old_values,'new_values',h.new_values,'reason',h.reason,'created_at',h.created_at) order by h.created_at desc)
    from public.appointment_history h where h.clinic_id=cid and h.appointment_id=aid),'[]') history
  from public.appointments a join public.patients p on p.id=a.patient_id and p.clinic_id=a.clinic_id
  join public.services s on s.id=a.service_id and s.clinic_id=a.clinic_id
  left join public.clinic_doctors d on d.id=a.doctor_location_id and d.clinic_id=a.clinic_id
  where a.clinic_id=cid and a.id=aid
 ) x;
 return item;
end $$;

create function public.update_appointment_notes(cid uuid,aid uuid,new_notes text,expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current public.appointments; changed public.appointments; begin
 if not private.has_permission(cid,'appointments.manage') then raise exception 'Access denied' using errcode='42501'; end if;
 if length(coalesce(new_notes,''))>5000 then raise exception 'Invalid notes'; end if;
 perform pg_advisory_xact_lock(hashtextextended(cid::text,21));
 select * into current from public.appointments where clinic_id=cid and id=aid for update;
 if current.id is null then raise exception 'Appointment unavailable'; end if;
 if expected_updated_at is null or current.updated_at<>expected_updated_at then raise exception 'Stale version' using errcode='40001'; end if;
 update public.appointments set notes=coalesce(new_notes,'') where id=aid returning * into changed;
 insert into public.appointment_history(organization_id,clinic_id,appointment_id,event,actor_id,old_values,new_values)
 values(current.organization_id,cid,aid,'UPDATED',auth.uid(),jsonb_build_object('notes_changed',false),jsonb_build_object('notes_changed',true));
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata)
 values(current.organization_id,cid,auth.uid(),'update','appointments',aid,'{"fields":["notes"]}');
 return jsonb_build_object('ok',true,'appointment_id',aid,'updated_at',changed.updated_at);
end $$;

-- Shared internal creation path. Both reception and website entry points call
-- this routine after their own authorization boundary.
create function private.create_appointment_internal(cid uuid,payload jsonb,actor uuid,allow_duplicate_override boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare oid uuid; aid uuid=gen_random_uuid(); pid uuid; sid uuid; starts timestamptz; source_value public.appointment_source; initial_status public.appointment_status;
 equipment_ids uuid[]; checked jsonb; assignment jsonb; warnings jsonb; override_warning boolean; created public.appointments; begin
 perform pg_advisory_xact_lock(hashtextextended(cid::text,21));
 select organization_id into oid from public.clinics where id=cid and archived_at is null;
 pid=(payload->>'patient_id')::uuid; sid=(payload->>'service_id')::uuid; starts=(payload->>'start_at')::timestamptz;
 if oid is null or not exists(select 1 from public.patients where id=pid and clinic_id=cid and active and archived_at is null) then raise exception 'Patient unavailable'; end if;
 select coalesce(array_agg(x::uuid),'{}') into equipment_ids from jsonb_array_elements_text(coalesce(payload->'equipment_ids','[]')) x;
 assignment=private.resolve_assignment(cid,sid,starts,nullif(payload->>'doctor_id','')::uuid,nullif(payload->>'room_id','')::uuid,equipment_ids,null);
 if not (assignment->>'ok')::boolean then return assignment||jsonb_build_object('warnings','[]'::jsonb); end if;
 warnings=private.duplicate_warnings(cid,pid,sid,starts,null);
 override_warning=coalesce((payload->>'override_duplicate')::boolean,false);
 if jsonb_array_length(warnings)>0 and not override_warning then return jsonb_build_object('ok',false,'conflicts','[]'::jsonb,'warnings',warnings,'requires_override',true); end if;
 if override_warning and jsonb_array_length(warnings)>0 and not allow_duplicate_override then raise exception 'Override access denied' using errcode='42501'; end if;
 if override_warning and jsonb_array_length(warnings)>0 and length(trim(coalesce(payload->>'override_reason','')))<3 then raise exception 'Override reason required'; end if;
 checked=assignment->'assignment'; source_value=coalesce((payload->>'source')::public.appointment_source,'RECEPTION'); initial_status=coalesce((payload->>'status')::public.appointment_status,'PENDING');
 if initial_status not in ('PENDING','CONFIRMED') then raise exception 'Invalid initial status'; end if;
 insert into public.appointments(id,organization_id,clinic_id,patient_id,service_id,doctor_location_id,start_at,end_at,occupied_start_at,occupied_end_at,duration_minutes,buffer_before,buffer_after,status,source,notes,created_by)
 values(aid,oid,cid,pid,sid,nullif(checked->>'doctor_id','')::uuid,(checked->>'start_at')::timestamptz,(checked->>'end_at')::timestamptz,
  (checked->>'occupied_start_at')::timestamptz,(checked->>'occupied_end_at')::timestamptz,(checked->>'duration_minutes')::integer,
  (checked->>'buffer_before')::integer,(checked->>'buffer_after')::integer,initial_status,source_value,coalesce(payload->>'notes',''),actor) returning * into created;
 perform private.write_resources(cid,oid,aid,checked);
 insert into public.appointment_history(organization_id,clinic_id,appointment_id,event,actor_id,new_values)
 values(oid,cid,aid,'CREATED',actor,private.appointment_snapshot(created));
 insert into public.appointment_history(organization_id,clinic_id,appointment_id,event,actor_id,new_values)
 values(oid,cid,aid,'RESOURCES_ASSIGNED',actor,jsonb_build_object('doctor_id',checked->'doctor_id','room_id',checked->'room_id','equipment',checked->'equipment'));
 if override_warning and jsonb_array_length(warnings)>0 then
  insert into public.appointment_history(organization_id,clinic_id,appointment_id,event,actor_id,new_values,reason)
  values(oid,cid,aid,'DUPLICATE_OVERRIDE',actor,jsonb_build_object('warnings',warnings),left(coalesce(payload->>'override_reason',''),1000));
 end if;
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata)
 values(oid,cid,actor,'create','appointments',aid,jsonb_build_object('source',source_value,'duplicate_override',override_warning and jsonb_array_length(warnings)>0));
 return jsonb_build_object('ok',true,'appointment_id',aid,'assignment',checked,'warnings',warnings,'updated_at',created.updated_at);
end $$;

create or replace function public.create_appointment(cid uuid,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$ begin
 if not private.has_permission(cid,'appointments.manage') or jsonb_typeof(payload)<>'object' then raise exception 'Access denied' using errcode='42501'; end if;
 return private.create_appointment_internal(cid,payload,auth.uid(),private.has_permission(cid,'appointments.override'));
end $$;

create function public.list_public_booking_clinics() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('slug',booking_slug,'name',name,'address',address,'timezone',timezone) order by name),'[]')
 from public.clinics where public_booking_enabled and booking_slug is not null and archived_at is null
$$;

create function public.public_booking_catalog(slug text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare cid uuid; clinic_data jsonb; begin
 select id,jsonb_build_object('slug',booking_slug,'name',name,'address',address,'timezone',timezone) into cid,clinic_data
 from public.clinics where booking_slug=slug and public_booking_enabled and archived_at is null;
 if cid is null then return null; end if;
 return jsonb_build_object('clinic',clinic_data,
  'specialities',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from public.specialities where clinic_id=cid and active and archived_at is null),'[]'),
  'services',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'duration_minutes',s.duration_minutes,'price',s.price,'doctor_requirement',s.doctor_requirement,'category',c.name,
    'speciality_ids',coalesce((select jsonb_agg(distinct ds.speciality_id) from public.doctor_services dvs join public.doctor_specialities ds on ds.doctor_location_id=dvs.doctor_location_id and ds.clinic_id=dvs.clinic_id where dvs.clinic_id=cid and dvs.service_id=s.id),'[]')) order by s.name)
   from public.services s left join public.service_categories c on c.id=s.category_id and c.clinic_id=s.clinic_id where s.clinic_id=cid and s.active and s.archived_at is null),'[]'),
  'doctors',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,
    'service_ids',coalesce((select jsonb_agg(ds.service_id) from public.doctor_services ds where ds.clinic_id=cid and ds.doctor_location_id=d.id),'[]'),
    'speciality_ids',coalesce((select jsonb_agg(ds.speciality_id) from public.doctor_specialities ds where ds.clinic_id=cid and ds.doctor_location_id=d.id),'[]')) order by d.name)
   from public.clinic_doctors d where d.clinic_id=cid and d.active and d.archived_at is null),'[]'));
end $$;

create function public.public_available_slots(slug text,sid uuid,day date,doctor_id uuid default null,request_key text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare cid uuid; tz text; window_start timestamptz; window_end timestamptz; cursor_at timestamptz; resolved jsonb; slots jsonb='[]'; begin
 select id,timezone into cid,tz from public.clinics where booking_slug=slug and public_booking_enabled and archived_at is null;
 if cid is null or request_key !~ '^[a-f0-9]{64}$' then raise exception 'Invalid request'; end if;
 perform private.consume_public_rate('availability:clinic:'||cid,60,600);
 perform private.consume_public_rate('availability:key:'||cid||':'||request_key,60,60);
 if day<(now() at time zone tz)::date or day>(now() at time zone tz)::date+180 then raise exception 'Invalid date'; end if;
 if not exists(select 1 from public.services where id=sid and clinic_id=cid and active and archived_at is null) then raise exception 'Invalid service'; end if;
 if $4 is not null and not exists(select 1 from public.doctor_services ds join public.doctor_locations d on d.id=ds.doctor_location_id and d.clinic_id=ds.clinic_id where ds.clinic_id=cid and ds.service_id=sid and ds.doctor_location_id=$4 and d.active and d.archived_at is null) then raise exception 'Invalid doctor'; end if;
 window_start=day::timestamp at time zone tz; window_end=(day+1)::timestamp at time zone tz; cursor_at=window_start;
 while cursor_at<window_end loop
  resolved=private.resolve_assignment(cid,sid,cursor_at,$4,null,'{}',null);
  if (resolved->>'ok')::boolean and ((resolved->'assignment'->>'end_at')::timestamptz)<=window_end then
   slots=slots||jsonb_build_array(jsonb_build_object('start_at',cursor_at,'end_at',resolved->'assignment'->'end_at','doctor_id',resolved->'assignment'->'doctor_id'));
  end if;
  cursor_at=cursor_at+interval '15 minutes';
 end loop;
 return slots;
end $$;

create function public.create_public_booking(slug text,payload jsonb,request_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cid uuid; oid uuid; patient uuid; patient_name text; patient_email text; patient_phone text; preview jsonb; result jsonb; key text; begin
 select id,organization_id into cid,oid from public.clinics where booking_slug=slug and public_booking_enabled and archived_at is null;
 if cid is null or request_key !~ '^[a-f0-9]{64}$' or jsonb_typeof(payload)<>'object' then raise exception 'Invalid request'; end if;
 perform private.consume_public_rate('booking:clinic:'||cid,60,100);
 perform private.consume_public_rate('booking:key:'||cid||':'||request_key,600,5);
 patient_name=trim(coalesce(payload->>'name','')); patient_email=lower(trim(coalesce(payload->>'email',''))); patient_phone=regexp_replace(coalesce(payload->>'phone',''),'[^0-9+]','','g');
 if length(patient_name) not between 2 and 160 or length(patient_email)>254 or length(patient_phone)>40 or (patient_email='' and length(patient_phone)<7) then raise exception 'Invalid patient data'; end if;
 if length(coalesce(payload->>'notes',''))>1000 then raise exception 'Invalid notes'; end if;
 perform pg_advisory_xact_lock(hashtextextended(cid::text,21));
 preview=private.resolve_assignment(cid,(payload->>'service_id')::uuid,(payload->>'start_at')::timestamptz,nullif(payload->>'doctor_id','')::uuid,null,'{}',null);
 if not coalesce((preview->>'ok')::boolean,false) then return jsonb_build_object('ok',false,'code','SLOT_UNAVAILABLE'); end if;
 select id into patient from public.patients p where p.clinic_id=cid and p.active and p.archived_at is null and
  ((patient_email<>'' and lower(p.email)=patient_email) or (length(patient_phone)>=7 and regexp_replace(p.phone,'[^0-9+]','','g')=patient_phone))
 order by case when patient_email<>'' and lower(p.email)=patient_email then 0 else 1 end,p.created_at limit 1;
 if patient is null then
  key='WEB-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
  insert into public.patients(organization_id,clinic_id,name,internal_id,email,phone)
  values(oid,cid,patient_name,key,patient_email,patient_phone) returning id into patient;
 end if;
 result=private.create_appointment_internal(cid,jsonb_build_object(
  'patient_id',patient,'service_id',payload->>'service_id','doctor_id',payload->'doctor_id','start_at',payload->>'start_at',
  'equipment_ids','[]'::jsonb,'source','WEBSITE','status','PENDING','notes',coalesce(payload->>'notes','')),
  null,false);
 if coalesce((result->>'ok')::boolean,false)=false then return jsonb_build_object('ok',false,'code','SLOT_UNAVAILABLE'); end if;
 return jsonb_build_object('ok',true,'appointment_id',result->'appointment_id','start_at',result->'assignment'->'start_at','end_at',result->'assignment'->'end_at');
end $$;

revoke all on table private.public_booking_rate_limits from public,anon,authenticated;
revoke all on function private.consume_public_rate(text,integer,integer),private.create_appointment_internal(uuid,jsonb,uuid,boolean) from public,anon,authenticated;
revoke all on function public.list_calendar_appointments(uuid,timestamptz,timestamptz,jsonb),public.read_appointment(uuid,uuid),public.update_appointment_notes(uuid,uuid,text,timestamptz) from public,anon;
grant execute on function public.list_calendar_appointments(uuid,timestamptz,timestamptz,jsonb),public.read_appointment(uuid,uuid),public.update_appointment_notes(uuid,uuid,text,timestamptz) to authenticated;
revoke all on function public.list_public_booking_clinics(),public.public_booking_catalog(text),public.public_available_slots(text,uuid,date,uuid,text),public.create_public_booking(text,jsonb,text) from public,authenticated;
grant execute on function public.list_public_booking_clinics(),public.public_booking_catalog(text),public.public_available_slots(text,uuid,date,uuid,text),public.create_public_booking(text,jsonb,text) to anon;
