create view public.clinic_doctors with (security_invoker=true) as
 select l.*,d.name,d.professional_code,d.email,d.phone from public.doctor_locations l join public.doctors d on d.id=l.doctor_id;
grant select on public.clinic_doctors to authenticated;

create function private.core_spec(module text) returns jsonb language sql immutable set search_path='' as $$
 select case module
 when 'patients' then '{"table":"patients","permission":"patients","fields":["name","internal_id","birth_date","sex","phone","email","address","city","postal_code","country","administrative_notes","active"]}'::jsonb
 when 'specialities' then '{"table":"specialities","permission":"catalog","fields":["name","description","active"]}'::jsonb
 when 'categories' then '{"table":"service_categories","permission":"catalog","fields":["name","description","active"]}'::jsonb
 when 'rooms' then '{"table":"rooms","permission":"catalog","fields":["name","type","capacity","active"]}'::jsonb
 when 'equipment' then '{"table":"equipment","permission":"catalog","fields":["name","type","internal_id","room_id","capacity","active"]}'::jsonb
 when 'services' then '{"table":"services","permission":"catalog","fields":["name","category_id","duration_minutes","price","buffer_before","buffer_after","instructions","required_documents","exclusion_rules","active"]}'::jsonb
 when 'doctors' then '{"table":"clinic_doctors","permission":"catalog","fields":["name","professional_code","email","phone","active"]}'::jsonb
 when 'availability' then '{"table":"availability_rules","permission":"availability","fields":["name","resource_kind","doctor_location_id","room_id","equipment_id","weekday","start_time","end_time","valid_from","valid_until","interval_kind","active"]}'::jsonb
 when 'exceptions' then '{"table":"schedule_exceptions","permission":"availability","fields":["name","resource_kind","doctor_location_id","room_id","equipment_id","starts_at","ends_at","exception_kind","notes","active"]}'::jsonb
 end
$$;

create function public.list_core(cid uuid,module text,query text default '',state text default 'active',sort_key text default 'name',descending boolean default false,page_number integer default 1,filter_id uuid default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare spec jsonb=private.core_spec(module); result jsonb; total bigint; predicate text; source text; ordering text; projection text='t.*'; begin
 if spec is null or not private.has_permission(cid,(spec->>'permission')||'.read') then raise exception 'Access denied' using errcode='42501'; end if;
 if page_number not between 1 and 100000 or length(query)>100 or state not in ('active','inactive','all','archived') or sort_key not in ('name','created_at','updated_at') then raise exception 'Invalid list options'; end if;
 source=format('public.%I t',spec->>'table');
 if module in ('availability','exceptions') then
 source=source||' left join public.clinic_doctors d on d.id=t.doctor_location_id and d.clinic_id=t.clinic_id left join public.rooms r on r.id=t.room_id and r.clinic_id=t.clinic_id left join public.equipment e on e.id=t.equipment_id and e.clinic_id=t.clinic_id left join public.clinics c on c.id=t.clinic_id';
 projection='t.*,coalesce(d.name,r.name,e.name,c.name) as resource_name';
 end if;
 predicate='t.clinic_id=$1 and (($3=''archived'' and t.archived_at is not null) or ($3<>''archived'' and t.archived_at is null and ($3=''all'' or t.active=($3=''active'')))) and ($2='''' or strpos(lower(concat_ws('' '',t.name,to_jsonb(t)->>''internal_id'',to_jsonb(t)->>''professional_code'',to_jsonb(t)->>''phone'',to_jsonb(t)->>''email'')),lower($2))>0)';
 if module='services' then predicate=predicate||' and ($4 is null or t.category_id=$4)';
 elsif module='doctors' then predicate=predicate||' and ($4 is null or exists(select 1 from public.doctor_specialities s where s.doctor_location_id=t.id and s.speciality_id=$4))';
 elsif module in ('availability','exceptions') then predicate=predicate||' and ($4 is null or coalesce(t.doctor_location_id,t.room_id,t.equipment_id,t.clinic_id)=$4)'; end if;
 ordering=format('t.%I %s,t.id',sort_key,case when descending then 'desc' else 'asc' end);
 execute 'select count(*) from '||source||' where '||predicate into total using cid,query,state,filter_id;
 execute 'select coalesce(jsonb_agg(to_jsonb(r)),''[]'') from (select '||projection||' from '||source||' where '||predicate||' order by '||ordering||' limit 25 offset $5) r'
 into result using cid,query,state,filter_id,(page_number-1)*25;
 return jsonb_build_object('items',result,'total',total);
end $$;

create function public.read_core(cid uuid,module text,entity_id uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare spec jsonb=private.core_spec(module); result jsonb; begin
 if spec is null or not private.has_permission(cid,(spec->>'permission')||'.read') then raise exception 'Access denied' using errcode='42501'; end if;
 execute format('select to_jsonb(t) from public.%I t where clinic_id=$1 and id=$2',spec->>'table') into result using cid,entity_id;
 if result is null then return null; end if;
 if module='doctors' then
 result=result||jsonb_build_object(
 'speciality_ids',coalesce((select jsonb_agg(speciality_id) from public.doctor_specialities where doctor_location_id=entity_id),'[]'),
 'room_ids',coalesce((select jsonb_agg(room_id) from public.doctor_rooms where doctor_location_id=entity_id),'[]'),
 'service_ids',coalesce((select jsonb_agg(service_id) from public.doctor_services where doctor_location_id=entity_id),'[]'),
 'locations',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'clinic_id',l.clinic_id,'name',c.name,'active',l.active)) from public.doctor_locations l join public.clinics c on c.id=l.clinic_id where l.doctor_id=(result->>'doctor_id')::uuid and l.archived_at is null),'[]'));
 elsif module='services' then
 result=result||jsonb_build_object(
 'doctor_ids',coalesce((select jsonb_agg(doctor_location_id) from public.doctor_services where service_id=entity_id),'[]'),
 'room_ids',coalesce((select jsonb_agg(room_id) from public.service_rooms where service_id=entity_id),'[]'),
 'equipment_ids',coalesce((select jsonb_agg(equipment_id) from public.service_equipment where service_id=entity_id),'[]'));
 end if;
 return result;
end $$;

-- Link synchronization is atomic with the entity save. Caller must be a clinic
-- administrator. Every selected target is verified inside that same clinic.
create function private.replace_core_links(cid uuid,module text,eid uuid,payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare rel record; target uuid; targets uuid[]; begin
 if not private.has_permission(cid,'catalog.manage') then raise exception 'Access denied' using errcode='42501'; end if;
 if module='services' and not exists(select 1 from public.services where id=eid and clinic_id=cid) then raise exception 'Invalid service'; end if;
 if module='doctors' and not exists(select 1 from public.doctor_locations where id=eid and clinic_id=cid) then raise exception 'Invalid doctor'; end if;
 for rel in select * from (values
 ('doctors','speciality_ids','doctor_specialities','doctor_location_id','speciality_id','specialities'),
 ('doctors','room_ids','doctor_rooms','doctor_location_id','room_id','rooms'),
 ('doctors','service_ids','doctor_services','doctor_location_id','service_id','services'),
 ('services','doctor_ids','doctor_services','service_id','doctor_location_id','doctor_locations'),
 ('services','room_ids','service_rooms','service_id','room_id','rooms'),
 ('services','equipment_ids','service_equipment','service_id','equipment_id','equipment')) r(mod,key,tab,source_col,target_col,target_table) where mod=module loop
 if payload ? rel.key then
 if jsonb_typeof(payload->rel.key)<>'array' or jsonb_array_length(payload->rel.key)>200 then raise exception 'Invalid links'; end if;
 select array_agg(distinct x::uuid) into targets from jsonb_array_elements_text(payload->rel.key) x;
 foreach target in array coalesce(targets,'{}'::uuid[]) loop
 execute format('select id from public.%I where id=$1 and clinic_id=$2 and archived_at is null and active for share',rel.target_table) into target using target,cid;
 if target is null then raise exception 'Resource belongs to another clinic or is inactive'; end if;
 end loop;
 execute format('delete from public.%I where %I=$1 and clinic_id=$2',rel.tab,rel.source_col) using eid,cid;
 foreach target in array coalesce(targets,'{}'::uuid[]) loop
 execute format('insert into public.%I(%I,%I,clinic_id) values($1,$2,$3)',rel.tab,rel.source_col,rel.target_col) using eid,target,cid;
 end loop;
 end if;
 end loop;
end $$;

create function public.save_core(cid uuid,module text,entity_id uuid,payload jsonb,expected_updated_at timestamptz default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare spec jsonb=private.core_spec(module); oid uuid; eid uuid=coalesce(entity_id,gen_random_uuid()); cols text; vals text; assignments text; present timestamptz; key text; begin
 if spec is null or module='doctors' or not private.has_permission(cid,(spec->>'permission')||'.manage') then raise exception 'Access denied' using errcode='42501'; end if;
 select organization_id into oid from public.clinics where id=cid;
 if jsonb_typeof(payload)<>'object' then raise exception 'Invalid payload'; end if;
 for key in select jsonb_object_keys(payload) loop
 if not (spec->'fields' ? key) and not (module='services' and key in ('doctor_ids','room_ids','equipment_ids')) then raise exception 'Invalid field'; end if;
 end loop;
 select string_agg(format('%I',f),','),string_agg(format('v.%I',f),','),string_agg(format('%I=v.%I',f,f),',') into cols,vals,assignments
 from jsonb_array_elements_text(spec->'fields') f where payload ? f;
 if cols is null then raise exception 'Empty payload'; end if;
 -- Serialize catalog link replacements within a clinic in a fixed lock order.
 perform pg_advisory_xact_lock(hashtextextended(cid::text,21));
 if entity_id is not null then
 execute format('select updated_at from public.%I where id=$1 and clinic_id=$2 and archived_at is null for update',spec->>'table') into present using eid,cid;
 if present is null then raise exception 'Record unavailable'; end if;
 if expected_updated_at is null or present<>expected_updated_at then raise exception 'Stale version' using errcode='40001'; end if;
 execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I,$1) v where t.id=$2 and t.clinic_id=$3',spec->>'table',assignments,spec->>'table') using payload,eid,cid;
 else
 execute format('insert into public.%I(id,organization_id,clinic_id,%s) select $2,$3,$4,%s from jsonb_populate_record(null::public.%I,$1) v',spec->>'table',cols,vals,spec->>'table') using payload,eid,oid,cid;
 end if;
 if module='services' then perform private.replace_core_links(cid,module,eid,payload); end if;
 return eid;
end $$;

create function public.save_doctor(cid uuid,entity_id uuid,payload jsonb,expected_updated_at timestamptz default null) returns uuid language plpgsql security definer set search_path='' as $$
declare oid uuid; did uuid; eid uuid; current_row public.doctor_locations; old_identity public.doctors; begin
 if not private.has_permission(cid,'catalog.manage') then raise exception 'Access denied' using errcode='42501'; end if;
 select organization_id into oid from public.clinics where id=cid;
 perform pg_advisory_xact_lock(hashtextextended(oid::text,22));
 perform pg_advisory_xact_lock(hashtextextended(cid::text,21));
 if entity_id is null then
 insert into public.doctors(organization_id,name,professional_code,email,phone) values(oid,payload->>'name',payload->>'professional_code',coalesce(payload->>'email',''),coalesce(payload->>'phone','')) returning id into did;
 insert into public.doctor_locations(organization_id,clinic_id,doctor_id,active) values(oid,cid,did,coalesce((payload->>'active')::boolean,true)) returning id into eid;
 insert into public.doctor_credentials(doctor_location_id,clinic_id,organization_id) values(eid,cid,oid);
 else
 select * into current_row from public.doctor_locations where id=entity_id and clinic_id=cid and archived_at is null for update;
 if current_row.id is null then raise exception 'Record unavailable'; end if;
 if expected_updated_at is null or current_row.updated_at<>expected_updated_at then raise exception 'Stale version' using errcode='40001'; end if;
 eid=entity_id; did=current_row.doctor_id;
 select * into old_identity from public.doctors where id=did for update;
 if (old_identity.name,old_identity.professional_code,old_identity.email,old_identity.phone) is distinct from (payload->>'name',payload->>'professional_code',coalesce(payload->>'email',''),coalesce(payload->>'phone','')) then
 if exists(select 1 from public.doctor_locations where doctor_id=did and not private.has_permission(clinic_id,'catalog.manage')) then raise exception 'Manage all doctor locations to change identity'; end if;
 update public.doctors set name=payload->>'name',professional_code=payload->>'professional_code',email=coalesce(payload->>'email',''),phone=coalesce(payload->>'phone','') where id=did;
 -- Invalidate other editors and record the shared identity edit in each clinic.
 update public.doctor_locations set updated_at=now() where doctor_id=did and id<>eid;
 end if;
 update public.doctor_locations set active=coalesce((payload->>'active')::boolean,true) where id=eid;
 end if;
 perform private.replace_core_links(cid,'doctors',eid,payload);
 return eid;
end $$;

create function public.attach_doctor(source_clinic uuid,source_id uuid,target_clinic uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare did uuid; oid uuid; target_org uuid; eid uuid; begin
 if not private.has_permission(source_clinic,'catalog.manage') or not private.has_permission(target_clinic,'catalog.manage') then raise exception 'Access denied' using errcode='42501'; end if;
 select doctor_id,organization_id into did,oid from public.doctor_locations where id=source_id and clinic_id=source_clinic and archived_at is null;
 select organization_id into target_org from public.clinics where id=target_clinic;
 if did is null or oid<>target_org then raise exception 'Invalid organization'; end if;
 perform pg_advisory_xact_lock(hashtextextended(oid::text,22));
 insert into public.doctor_locations(organization_id,clinic_id,doctor_id) values(oid,target_clinic,did) returning id into eid;
 insert into public.doctor_credentials(doctor_location_id,clinic_id,organization_id) values(eid,target_clinic,oid);
 return eid;
end $$;

create function public.archive_core(cid uuid,module text,entity_id uuid,restore boolean default false) returns void language plpgsql security invoker set search_path='' as $$
declare spec jsonb=private.core_spec(module); tab text; affected integer; begin
 if spec is null or not private.has_permission(cid,(spec->>'permission')||'.manage') then raise exception 'Access denied' using errcode='42501'; end if;
 tab=case when module='doctors' then 'doctor_locations' else spec->>'table' end;
 perform pg_advisory_xact_lock(hashtextextended(cid::text,21));
 execute format('update public.%I set archived_at=case when $3 then null else now() end,active=$3 where id=$1 and clinic_id=$2',tab) using entity_id,cid,restore;
 get diagnostics affected=row_count; if affected<>1 then raise exception 'Record unavailable'; end if;
end $$;

create function public.patient_history(cid uuid,pid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$ begin
 if not private.has_permission(cid,'patients.read') or not exists(select 1 from public.patients where clinic_id=cid and id=pid) then raise exception 'Access denied' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(e)),'[]') from (select action,created_at,metadata from public.audit_logs where clinic_id=cid and entity='patients' and entity_id=pid order by created_at desc limit 100) e);
end $$;
revoke all on function private.core_spec(text),private.replace_core_links(uuid,text,uuid,jsonb) from public,anon;
grant execute on function private.core_spec(text),private.replace_core_links(uuid,text,uuid,jsonb) to authenticated;
revoke all on function public.list_core(uuid,text,text,text,text,boolean,integer,uuid),public.read_core(uuid,text,uuid),public.save_core(uuid,text,uuid,jsonb,timestamptz),public.save_doctor(uuid,uuid,jsonb,timestamptz),public.attach_doctor(uuid,uuid,uuid),public.archive_core(uuid,text,uuid,boolean),public.patient_history(uuid,uuid) from public,anon;
grant execute on function public.list_core(uuid,text,text,text,text,boolean,integer,uuid),public.read_core(uuid,text,uuid),public.save_core(uuid,text,uuid,jsonb,timestamptz),public.save_doctor(uuid,uuid,jsonb,timestamptz),public.attach_doctor(uuid,uuid,uuid),public.archive_core(uuid,text,uuid,boolean),public.patient_history(uuid,uuid) to authenticated;
