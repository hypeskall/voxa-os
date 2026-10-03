-- Materialize the persisted setup in ONE transaction. IDs below are draft
-- UUIDs, never trusted tenant identity: every relationship is checked first.
create function public.finish_onboarding(oid uuid,expected_revision integer,invite_digests jsonb default '{}') returns uuid language plpgsql security definer set search_path='' as $$
declare draft jsonb; org jsonb; loc jsonb; svc jsonb; doc jsonb; room jsonb; day jsonb; invited jsonb;
 cid uuid; first_cid uuid; did uuid; dlid uuid; sid uuid; rid uuid; key text; location_key text; service_key text; speciality_id uuid;
begin
 if not private.org_owner(oid) then raise exception 'Access denied' using errcode='42501'; end if;
 perform 1 from public.organizations where id=oid and not onboarding_completed for update;
 if not found then raise exception 'Setup already completed'; end if;
 select payload into draft from public.onboarding_drafts where organization_id=oid and revision=expected_revision for update;
 if draft is null then raise exception 'Stale version' using errcode='40001'; end if;
 if jsonb_array_length(draft->'locations') not between 1 and 20 or jsonb_array_length(draft->'services') not between 1 and 200
 or jsonb_array_length(draft->'doctors') not between 1 and 100 or jsonb_array_length(draft->'rooms')>100 or jsonb_array_length(draft->'team')>30
 or draft->'clinic' is null or draft->'locations' is null or draft->'services' is null or draft->'doctors' is null or draft->'rooms' is null or draft->'team' is null then raise exception 'Invalid setup'; end if;
 org=draft->'clinic';
 if length(trim(coalesce(org->>'name',''))) not between 2 and 100 or coalesce(org->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 or (coalesce(org->>'website','')<>'' and org->>'website' !~ '^https?://[^[:space:]]+$')
 or (coalesce(org->>'phone','')<>'' and org->>'phone' !~ '^[+0-9 ()-]{7,40}$') then raise exception 'Invalid clinic identity'; end if;
 update public.organizations set name=org->>'name',legal_name=coalesce(org->>'legal_name',''),cui=coalesce(org->>'cui',''),
 phone=coalesce(org->>'phone',''),email=coalesce(org->>'email',''),website=coalesce(org->>'website',''),specialty=coalesce(org->>'specialty','') where id=oid;
 select id into first_cid from public.clinics where organization_id=oid order by created_at,id limit 1;
 if first_cid is null or (draft->'locations'->0->>'id')::uuid<>first_cid then raise exception 'Invalid initial location'; end if;
 for loc in select value from jsonb_array_elements(draft->'locations') loop
  if length(trim(coalesce(loc->>'name',''))) not between 2 and 100 or length(trim(coalesce(loc->>'city',''))) not between 2 and 100
  or (coalesce(loc->>'email','')<>'' and loc->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
  or (coalesce(loc->>'phone','')<>'' and loc->>'phone' !~ '^[+0-9 ()-]{7,40}$') then raise exception 'Invalid location identity'; end if;
  cid=(loc->>'id')::uuid;
  if cid=first_cid then
   update public.clinics set name=loc->>'name',address=coalesce(loc->>'address',''),city=coalesce(loc->>'city',''),county=coalesce(loc->>'county',''),phone=coalesce(loc->>'phone',''),email=coalesce(loc->>'email','') where id=cid and organization_id=oid;
  else
   -- A collision with an existing location fails rather than retargeting it.
   insert into public.clinics(id,organization_id,name,address,city,county,phone,email)
   values(cid,oid,loc->>'name',coalesce(loc->>'address',''),coalesce(loc->>'city',''),coalesce(loc->>'county',''),coalesce(loc->>'phone',''),coalesce(loc->>'email',''));
   insert into public.clinic_memberships(user_id,organization_id,clinic_id,role)
   select user_id,oid,cid,'OWNER' from public.organization_members where organization_id=oid and role='OWNER' and status='active';
  end if;
  if jsonb_array_length(loc->'hours')<>7 or (select count(distinct (value->>'weekday')::integer) from jsonb_array_elements(loc->'hours'))<>7 then raise exception 'Invalid weekly schedule'; end if;
  perform public.save_clinic_weekly_schedule(cid,loc->'hours');
  if not exists(select 1 from public.availability_rules where clinic_id=cid and active and archived_at is null and resource_kind='clinic') then raise exception 'Location needs working hours'; end if;
 end loop;
 for svc in select value from jsonb_array_elements(draft->'services') loop
  if length(trim(coalesce(svc->>'name',''))) not between 2 and 160 or coalesce(svc->>'price','') !~ '^[0-9]{1,8}(\.[0-9]{1,2})?$'
  or coalesce((svc->>'duration_minutes')::integer,0) not between 5 and 1440 then raise exception 'Invalid service'; end if;
  cid=(svc->>'location_id')::uuid;
  if not exists(select 1 from jsonb_array_elements(draft->'locations') l where (l->>'id')::uuid=cid) then raise exception 'Invalid service location'; end if;
  sid=(svc->>'id')::uuid;
  insert into public.services(id,organization_id,clinic_id,name,price,duration_minutes,instructions,doctor_requirement,room_required)
  values(sid,oid,cid,svc->>'name',(svc->>'price')::numeric,(svc->>'duration_minutes')::integer,coalesce(svc->>'description',''),'required',false);
 end loop;
 for room in select value from jsonb_array_elements(draft->'rooms') loop
  cid=(room->>'location_id')::uuid; rid=(room->>'id')::uuid;
  if not exists(select 1 from jsonb_array_elements(draft->'locations') l where (l->>'id')::uuid=cid) then raise exception 'Invalid room location'; end if;
  insert into public.rooms(id,organization_id,clinic_id,name,type) values(rid,oid,cid,room->>'name',coalesce(room->>'description',''));
  -- Rooms initially follow location hours, explicitly disclosed by wizard.
  insert into public.availability_rules(organization_id,clinic_id,name,resource_kind,room_id,weekday,start_time,end_time,valid_from)
  select oid,cid,'Program cabinet','room',rid,weekday,start_time,end_time,valid_from from public.availability_rules
  where clinic_id=cid and resource_kind='clinic' and interval_kind='work' and active and archived_at is null;
 end loop;
 for doc in select value from jsonb_array_elements(draft->'doctors') loop
  if length(trim(coalesce(doc->>'first_name',''))) not between 2 and 80 or length(trim(coalesce(doc->>'last_name',''))) not between 2 and 80
  or (coalesce(doc->>'email','')<>'' and doc->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
  or (coalesce(doc->>'phone','')<>'' and doc->>'phone' !~ '^[+0-9 ()-]{7,40}$') then raise exception 'Invalid doctor identity'; end if;
  did=(doc->>'id')::uuid;
  if jsonb_array_length(doc->'location_ids') not between 1 and 20 or jsonb_array_length(doc->'service_ids') not between 1 and 200 then raise exception 'Doctor requires location and services'; end if;
  insert into public.doctors(id,organization_id,name,professional_code,email,phone,calendar_color)
  values(did,oid,concat_ws(' ',doc->>'first_name',doc->>'last_name'),coalesce(nullif(doc->>'professional_code',''),'VOXA-'||did::text),coalesce(doc->>'email',''),coalesce(doc->>'phone',''),coalesce(doc->>'color','#397766'));
  for location_key in select distinct value from jsonb_array_elements_text(doc->'location_ids') loop
   cid=location_key::uuid;
   if not exists(select 1 from jsonb_array_elements(draft->'locations') l where (l->>'id')::uuid=cid) then raise exception 'Invalid doctor location'; end if;
   insert into public.doctor_locations(organization_id,clinic_id,doctor_id) values(oid,cid,did) returning id into dlid;
   insert into public.doctor_credentials(doctor_location_id,clinic_id,organization_id) values(dlid,cid,oid);
   if length(trim(coalesce(doc->>'specialty','')))>=2 then
    insert into public.specialities(organization_id,clinic_id,name) values(oid,cid,doc->>'specialty') on conflict(clinic_id,name) do update set active=true returning id into speciality_id;
    insert into public.doctor_specialities(doctor_location_id,speciality_id,clinic_id) values(dlid,speciality_id,cid);
   end if;
   for service_key in select distinct value from jsonb_array_elements_text(doc->'service_ids') loop
    if not exists(select 1 from public.services where id=service_key::uuid and organization_id=oid and id in(select (s->>'id')::uuid from jsonb_array_elements(draft->'services') s)) then raise exception 'Invalid doctor service'; end if;
    insert into public.doctor_services(doctor_location_id,service_id,clinic_id)
    select dlid,id,cid from public.services where id=service_key::uuid and clinic_id=cid;
   end loop;
   if not exists(select 1 from public.doctor_services where doctor_location_id=dlid) then raise exception 'Doctor needs services in each assigned location'; end if;
   insert into public.availability_rules(organization_id,clinic_id,name,resource_kind,doctor_location_id,weekday,start_time,end_time,valid_from)
   select oid,cid,'Program medic','doctor',dlid,weekday,start_time,end_time,valid_from from public.availability_rules
   where clinic_id=cid and resource_kind='clinic' and interval_kind='work' and active and archived_at is null;
  end loop;
 end loop;
 if exists(select 1 from public.services s where s.organization_id=oid and s.id in(select (v->>'id')::uuid from jsonb_array_elements(draft->'services') v) and not exists(select 1 from public.doctor_services ds where ds.service_id=s.id)) then raise exception 'Every service needs a doctor'; end if;
 for invited in select value from jsonb_array_elements(draft->'team') loop
  cid=(invited->>'location_id')::uuid;
  if not exists(select 1 from jsonb_array_elements(draft->'locations') l where (l->>'id')::uuid=cid) then raise exception 'Invalid invite location'; end if;
  perform public.create_staff_invite(cid,invited->>'email',(invited->>'role')::public.clinic_role,invite_digests->>(invited->>'id'));
 end loop;
 update public.organizations set onboarding_completed=true where id=oid;
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id) values(oid,first_cid,auth.uid(),'onboarding_complete','organizations',oid);
 return first_cid;
end $$;
revoke all on function public.finish_onboarding(uuid,integer,jsonb) from public,anon;
grant execute on function public.finish_onboarding(uuid,integer,jsonb) to authenticated;

-- Private branding storage is separate from medical files and has tenant RLS.
create function public.can_access_branding(object_name text,access_mode text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare oid uuid;
begin
 begin oid=split_part(object_name,'/',1)::uuid; exception when others then return false; end;
 if split_part(object_name,'/',2)<>'logo' or array_length(string_to_array(object_name,'/'),1)<>3 then return false; end if;
 return case when access_mode='read' then private.org_member(oid) when access_mode='write' then private.org_owner(oid) else false end;
end $$;
revoke all on function public.can_access_branding(text,text) from public,anon;
grant execute on function public.can_access_branding(text,text) to authenticated;
do $$ begin if to_regclass('storage.buckets') is not null then
 insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('voxa-branding','voxa-branding',false,5242880,array['image/png','image/jpeg','image/webp']) on conflict(id) do nothing;
 execute $policy$create policy voxa_branding_read on storage.objects for select to authenticated using(bucket_id='voxa-branding' and public.can_access_branding(name,'read'))$policy$;
 execute $policy$create policy voxa_branding_insert on storage.objects for insert to authenticated with check(bucket_id='voxa-branding' and public.can_access_branding(name,'write'))$policy$;
 execute $policy$create policy voxa_branding_delete on storage.objects for delete to authenticated using(bucket_id='voxa-branding' and public.can_access_branding(name,'write'))$policy$;
end if; end $$;
create function public.set_organization_logo(oid uuid,path text) returns void language plpgsql security definer set search_path='' as $$
declare cid uuid;
begin
 if not private.org_owner(oid) or not public.can_access_branding(path,'write') or split_part(path,'/',1)<>oid::text then raise exception 'Access denied' using errcode='42501'; end if;
 update public.organizations set logo_path=path where id=oid;
 select id into cid from public.clinics where organization_id=oid order by created_at,id limit 1;
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id) values(oid,cid,auth.uid(),'logo_update','organizations',oid);
end $$;
revoke all on function public.set_organization_logo(uuid,text) from public,anon;
grant execute on function public.set_organization_logo(uuid,text) to authenticated;
