create function public.save_organization_identity(oid uuid,payload jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.org_owner(oid) then raise exception 'Access denied' using errcode='42501'; end if;
 if jsonb_typeof(payload)<>'object' or exists(select 1 from jsonb_object_keys(payload) k where k not in ('name','legal_name','cui','phone','email','website','specialty')) then raise exception 'Invalid fields'; end if;
 if length(trim(coalesce(payload->>'name',''))) not between 2 and 100
 or (coalesce(payload->>'email','')<>'' and payload->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
 or (coalesce(payload->>'website','')<>'' and payload->>'website' !~ '^https?://[^[:space:]]+$')
 or (coalesce(payload->>'phone','')<>'' and payload->>'phone' !~ '^[+0-9 ()-]{7,40}$') then raise exception 'Invalid clinic identity'; end if;
 update public.organizations set name=payload->>'name',legal_name=coalesce(payload->>'legal_name',''),cui=coalesce(payload->>'cui',''),
 phone=coalesce(payload->>'phone',''),email=coalesce(payload->>'email',''),website=coalesce(payload->>'website',''),specialty=coalesce(payload->>'specialty','') where id=oid;
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata)
 select oid,id,auth.uid(),'update','organizations',oid,'{"fields":["identity"]}'::jsonb from public.clinics where organization_id=oid and archived_at is null;
end $$;
revoke all on function public.save_organization_identity(uuid,jsonb) from public,anon;
grant execute on function public.save_organization_identity(uuid,jsonb) to authenticated;

create function public.doctor_calendar_colors(cid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.has_permission(cid,'catalog.read') then raise exception 'Access denied' using errcode='42501'; end if;
 return (select coalesce(jsonb_object_agg(l.id,d.calendar_color),'{}') from public.doctor_locations l join public.doctors d on d.id=l.doctor_id and d.organization_id=l.organization_id where l.clinic_id=cid and l.active and l.archived_at is null);
end $$;
revoke all on function public.doctor_calendar_colors(uuid) from public,anon;
grant execute on function public.doctor_calendar_colors(uuid) to authenticated;

-- Preserve all location form fields atomically; the older three-field RPC
-- remains available to existing integrations.
create function public.create_location(oid uuid,payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid;
begin
 if not private.org_owner(oid) then raise exception 'Access denied' using errcode='42501'; end if;
 if jsonb_typeof(payload)<>'object' or exists(select 1 from jsonb_object_keys(payload) k where k not in
 ('name','address','city','county','postal_code','phone','phone_secondary','email','timezone','public_booking_enabled','booking_slug','scheduling_increment_minutes','calendar_visible_start','calendar_visible_end','whatsapp_reminder_template')) then raise exception 'Invalid fields'; end if;
 cid=public.create_clinic(oid,payload->>'name',coalesce(payload->>'address',''),coalesce(payload->>'timezone','Europe/Bucharest'));
 update public.clinics set city=coalesce(payload->>'city',''),county=coalesce(payload->>'county',''),postal_code=coalesce(payload->>'postal_code',''),
 phone=coalesce(payload->>'phone',''),phone_secondary=coalesce(payload->>'phone_secondary',''),email=coalesce(payload->>'email',''),
 public_booking_enabled=coalesce((payload->>'public_booking_enabled')::boolean,false),booking_slug=nullif(payload->>'booking_slug',''),
 scheduling_increment_minutes=coalesce((payload->>'scheduling_increment_minutes')::integer,15),
 calendar_visible_start=coalesce((payload->>'calendar_visible_start')::time,'08:00'::time),calendar_visible_end=coalesce((payload->>'calendar_visible_end')::time,'20:00'::time),
 whatsapp_reminder_template=coalesce(payload->>'whatsapp_reminder_template',whatsapp_reminder_template) where id=cid and organization_id=oid;
 return cid;
end $$;
revoke all on function public.create_location(uuid,jsonb) from public,anon;
grant execute on function public.create_location(uuid,jsonb) to authenticated;
