alter table public.organizations add column privileged_mfa_required boolean not null default false;
create function private.privileged_mfa_required() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.clinic_memberships m join public.organizations o on o.id=m.organization_id where m.user_id=auth.uid() and m.active and m.role in ('OWNER','ADMIN') and o.privileged_mfa_required)
$$;
revoke all on function private.privileged_mfa_required() from public,anon,authenticated;
create or replace function private.mfa_satisfied() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is null or
  (coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'aal','aal1')='aal2' and exists(select 1 from auth.mfa_factors where user_id=auth.uid() and status='verified')) or
  (not private.privileged_mfa_required() and not exists(select 1 from auth.mfa_factors where user_id=auth.uid() and status='verified'))
$$;
-- Bootstrap reveals only the caller's own enrollment requirement.
create function public.my_mfa_enrollment_required() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and private.privileged_mfa_required() and not exists(select 1 from auth.mfa_factors where user_id=auth.uid() and status='verified')
$$;
revoke all on function public.my_mfa_enrollment_required() from public;
grant execute on function public.my_mfa_enrollment_required() to anon,authenticated;
create function public.my_mfa_policy_required() returns boolean language sql stable security definer set search_path='' as $$ select auth.uid() is not null and private.privileged_mfa_required() $$;
revoke all on function public.my_mfa_policy_required() from public;
grant execute on function public.my_mfa_policy_required() to anon,authenticated;
create function public.set_organization_mfa_policy(cid uuid,required boolean) returns void language plpgsql security definer set search_path='' as $$
declare oid uuid; begin
 perform private.require_mfa();
 if not private.has_permission(cid,'organization.manage') then raise exception 'Access denied' using errcode='42501'; end if;
 if coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'aal','aal1')<>'aal2' or not exists(select 1 from auth.mfa_factors where user_id=auth.uid() and status='verified') then raise exception 'Enroll and verify MFA before changing policy' using errcode='42501'; end if;
 select organization_id into oid from public.clinics where id=cid;
 update public.organizations set privileged_mfa_required=required where id=oid;
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata) values(oid,cid,auth.uid(),'mfa_policy_changed','organizations',oid,jsonb_build_object('required',required));
end $$;
revoke all on function public.set_organization_mfa_policy(uuid,boolean) from public,anon;
grant execute on function public.set_organization_mfa_policy(uuid,boolean) to authenticated;
