-- Demo readiness for the single-location Clinica Maria installation.
-- Multi-tenant keys and policies remain authoritative; these additions only
-- expose missing clinic contact data and richer operational projections.

alter table public.clinics
  add column phone_secondary text not null default '' check(length(phone_secondary) <= 40),
  add column email text not null default '' check(length(email) <= 254);

alter table public.services
  add column duration_is_demo_default boolean not null default false;

grant update(phone_secondary,email) on public.clinics to authenticated;

create or replace function private.core_spec(module text) returns jsonb
language sql immutable set search_path='' as $$
 select case module
 when 'patients' then '{"table":"patients","permission":"patients","fields":["name","internal_id","birth_date","sex","phone","email","address","city","postal_code","country","administrative_notes","active"]}'::jsonb
 when 'specialities' then '{"table":"specialities","permission":"catalog","fields":["name","description","active"]}'::jsonb
 when 'categories' then '{"table":"service_categories","permission":"catalog","fields":["name","description","active"]}'::jsonb
 when 'rooms' then '{"table":"rooms","permission":"catalog","fields":["name","type","capacity","active"]}'::jsonb
 when 'equipment' then '{"table":"equipment","permission":"catalog","fields":["name","type","internal_id","room_id","capacity","active"]}'::jsonb
 when 'services' then '{"table":"services","permission":"catalog","fields":["name","category_id","duration_minutes","duration_is_demo_default","price","buffer_before","buffer_after","doctor_requirement","room_required","minimum_room_capacity","instructions","required_documents","exclusion_rules","active"]}'::jsonb
 when 'doctors' then '{"table":"clinic_doctors","permission":"catalog","fields":["name","professional_code","email","phone","active"]}'::jsonb
 when 'availability' then '{"table":"availability_rules","permission":"availability","fields":["name","resource_kind","doctor_location_id","room_id","equipment_id","weekday","start_time","end_time","valid_from","valid_until","interval_kind","active"]}'::jsonb
 when 'exceptions' then '{"table":"schedule_exceptions","permission":"availability","fields":["name","resource_kind","doctor_location_id","room_id","equipment_id","starts_at","ends_at","exception_kind","notes","active"]}'::jsonb
 end
$$;

create or replace function public.list_core(
  cid uuid,module text,query text default '',state text default 'active',
  sort_key text default 'name',descending boolean default false,
  page_number integer default 1,filter_id uuid default null
) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
 spec jsonb=private.core_spec(module); result jsonb; total bigint;
 predicate text; source text; ordering text; projection text='t.*';
begin
 if spec is null or not private.has_permission(cid,(spec->>'permission')||'.read') then
  raise exception 'Access denied' using errcode='42501';
 end if;
 if page_number not between 1 and 100000 or length(query)>100
    or state not in ('active','inactive','all','archived')
    or sort_key not in ('name','created_at','updated_at') then
  raise exception 'Invalid list options';
 end if;
 source=format('public.%I t',spec->>'table');
 if module='services' then
  source=source||' left join public.service_categories cat on cat.id=t.category_id and cat.clinic_id=t.clinic_id';
  projection='t.*,cat.name as category_name,'||
   'coalesce((select string_agg(d.name, '', '' order by d.name) from public.doctor_services ds join public.clinic_doctors d on d.id=ds.doctor_location_id and d.clinic_id=ds.clinic_id where ds.clinic_id=t.clinic_id and ds.service_id=t.id),'''') as doctor_names,'||
   'coalesce((select string_agg(r.name, '', '' order by r.name) from public.service_rooms sr join public.rooms r on r.id=sr.room_id and r.clinic_id=sr.clinic_id where sr.clinic_id=t.clinic_id and sr.service_id=t.id),'''') as room_names,'||
   'coalesce((select string_agg(e.name, '', '' order by e.name) from public.service_equipment se join public.equipment e on e.id=se.equipment_id and e.clinic_id=se.clinic_id where se.clinic_id=t.clinic_id and se.service_id=t.id),'''') as equipment_names';
 elsif module='doctors' then
  projection='t.*,'||
   'coalesce((select string_agg(s.name, '', '' order by s.name) from public.doctor_specialities ds join public.specialities s on s.id=ds.speciality_id and s.clinic_id=ds.clinic_id where ds.clinic_id=t.clinic_id and ds.doctor_location_id=t.id),'''') as speciality_names,'||
   'coalesce((select string_agg(s.name, '', '' order by s.name) from public.doctor_services ds join public.services s on s.id=ds.service_id and s.clinic_id=ds.clinic_id where ds.clinic_id=t.clinic_id and ds.doctor_location_id=t.id),'''') as service_names,'||
   '(select count(*) from public.availability_rules a where a.clinic_id=t.clinic_id and a.doctor_location_id=t.id and a.active and a.archived_at is null) as availability_count';
 elsif module in ('availability','exceptions') then
  source=source||' left join public.clinic_doctors d on d.id=t.doctor_location_id and d.clinic_id=t.clinic_id left join public.rooms r on r.id=t.room_id and r.clinic_id=t.clinic_id left join public.equipment e on e.id=t.equipment_id and e.clinic_id=t.clinic_id left join public.clinics c on c.id=t.clinic_id';
  projection='t.*,coalesce(d.name,r.name,e.name,c.name) as resource_name';
 end if;
 predicate='t.clinic_id=$1 and (($3=''archived'' and t.archived_at is not null) or ($3<>''archived'' and t.archived_at is null and ($3=''all'' or t.active=($3=''active'')))) and ($2='''' or strpos(lower(concat_ws('' '',t.name,to_jsonb(t)->>''internal_id'',to_jsonb(t)->>''professional_code'',to_jsonb(t)->>''phone'',to_jsonb(t)->>''email'')),lower($2))>0)';
 if module='services' then
  predicate=predicate||' and ($4 is null or t.category_id=$4)';
 elsif module='doctors' then
  predicate=predicate||' and ($4 is null or exists(select 1 from public.doctor_specialities s where s.doctor_location_id=t.id and s.speciality_id=$4))';
 elsif module in ('availability','exceptions') then
  predicate=predicate||' and ($4 is null or coalesce(t.doctor_location_id,t.room_id,t.equipment_id,t.clinic_id)=$4)';
 end if;
 ordering=format('t.%I %s,t.id',sort_key,case when descending then 'desc' else 'asc' end);
 execute 'select count(*) from '||source||' where '||predicate into total using cid,query,state,filter_id;
 execute 'select coalesce(jsonb_agg(to_jsonb(r)),''[]'') from (select '||projection||' from '||source||' where '||predicate||' order by '||ordering||' limit 25 offset $5) r'
  into result using cid,query,state,filter_id,(page_number-1)*25;
 return jsonb_build_object('items',result,'total',total);
end $$;

create function public.save_clinic_weekly_schedule(cid uuid,payload jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare oid uuid; item jsonb; day_value integer; start_value time; end_value time;
begin
 if not private.has_permission(cid,'availability.manage') then
  raise exception 'Access denied' using errcode='42501';
 end if;
 if jsonb_typeof(payload)<>'array' or jsonb_array_length(payload)<>7 then
  raise exception 'Invalid weekly schedule';
 end if;
 select organization_id into oid from public.clinics where id=cid and archived_at is null;
 if oid is null then raise exception 'Clinic unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(cid::text,31));
 update public.availability_rules set active=false,archived_at=now()
  where clinic_id=cid and resource_kind='clinic' and interval_kind='work' and archived_at is null;
 for item in select value from jsonb_array_elements(payload) loop
  day_value=(item->>'weekday')::integer;
  if day_value not between 1 and 7 then raise exception 'Invalid weekday'; end if;
  if coalesce((item->>'closed')::boolean,false)=false then
   start_value=(item->>'start_time')::time;
   end_value=(item->>'end_time')::time;
   if end_value<=start_value then raise exception 'Invalid clinic interval'; end if;
   insert into public.availability_rules(
    organization_id,clinic_id,name,resource_kind,weekday,start_time,end_time,
    valid_from,interval_kind,active
   ) values(
    oid,cid,'Program clinică', 'clinic',day_value,start_value,end_value,
    current_date,'work',true
   );
  end if;
 end loop;
end $$;

revoke all on function public.save_clinic_weekly_schedule(uuid,jsonb) from public,anon;
grant execute on function public.save_clinic_weekly_schedule(uuid,jsonb) to authenticated;

