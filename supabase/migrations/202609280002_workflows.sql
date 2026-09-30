-- All elevated workflows use the caller's identity, fixed search_path and explicit grants.
create function public.create_organization(org_name text, clinic_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare oid uuid; cid uuid; begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if exists(select 1 from public.clinic_memberships where user_id=auth.uid()) then raise exception 'Organization already assigned'; end if;
 insert into public.organizations(name) values(trim(org_name)) returning id into oid;
 insert into public.clinics(organization_id,name) values(oid,trim(clinic_name)) returning id into cid;
 insert into public.clinic_memberships(user_id,organization_id,clinic_id,role) values(auth.uid(),oid,cid,'OWNER');
 return cid; end $$;
create function public.create_clinic(oid uuid, clinic_name text, clinic_address text, clinic_timezone text) returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid; begin
 if not private.org_owner(oid) then raise exception 'Access denied'; end if;
 insert into public.clinics(organization_id,name,address,timezone) values(oid,trim(clinic_name),trim(clinic_address),clinic_timezone) returning id into cid;
 insert into public.clinic_memberships(user_id,organization_id,clinic_id,role) values(auth.uid(),oid,cid,'OWNER'); return cid; end $$;
create function public.set_membership(cid uuid, target_email text, target_role public.clinic_role, is_active boolean) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid; oid uuid; previous_role public.clinic_role; begin
 select organization_id into oid from public.clinics where id=cid for update;
 if not private.has_permission(cid,'members.manage') then raise exception 'Access denied'; end if;
 select id into uid from auth.users where lower(email)=lower(trim(target_email));
 if uid is null then raise exception 'Account unavailable'; end if;
 if uid=auth.uid() then raise exception 'Cannot change own access'; end if;
 select role into previous_role from public.clinic_memberships where user_id=uid and clinic_id=cid;
 if (target_role='OWNER' or previous_role='OWNER') and not private.org_owner(oid) then raise exception 'Owner required'; end if;
 if previous_role='OWNER' and (target_role<>'OWNER' or not is_active) and not exists(select 1 from public.clinic_memberships where clinic_id=cid and role='OWNER' and active and user_id<>uid) then raise exception 'Last owner'; end if;
 insert into public.clinic_memberships(user_id,organization_id,clinic_id,role,active) values(uid,oid,cid,target_role,is_active)
 on conflict(user_id,clinic_id) do update set role=excluded.role,active=excluded.active;
 end $$;
create function public.my_permissions(cid uuid) returns setof text language sql stable security definer set search_path='' as $$
 select r.permission from public.clinic_memberships m join public.role_permissions r on r.role=m.role join public.clinics c on c.id=m.clinic_id where m.user_id=auth.uid() and m.clinic_id=cid and m.active and c.archived_at is null
$$;
create function public.record_login() returns void language plpgsql security definer set search_path='' as $$
begin insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id)
 select organization_id,clinic_id,auth.uid(),'login','profiles',auth.uid() from public.clinic_memberships where user_id=auth.uid() and active; end $$;
revoke execute on all functions in schema public from public,anon,authenticated;
revoke execute on all functions in schema private from public,anon;
grant execute on function public.create_organization(text,text), public.create_clinic(uuid,text,text,text),public.set_membership(uuid,text,public.clinic_role,boolean),public.my_permissions(uuid),public.record_login() to authenticated;
