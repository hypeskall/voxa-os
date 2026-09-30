create function private.audit_organization() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata)
 select new.id,c.id,auth.uid(),'update','organizations',new.id,'{"fields":["name"]}'::jsonb
 from public.clinics c where c.organization_id=new.id and c.archived_at is null;
 return new;
end $$;
revoke execute on function private.audit_organization() from public,anon,authenticated;
create trigger organization_audit after update of name on public.organizations for each row when(old.name is distinct from new.name) execute function private.audit_organization();

-- PostgREST upsert includes the conflict key in the UPDATE list. RLS still
-- restricts both old and new user_id to auth.uid(), so reassignment is denied.
grant update(user_id) on public.user_preferences to authenticated;
-- Users may inspect their own revoked membership (never clinic data), which
-- lets onboarding distinguish unassigned accounts from suspended access.
drop policy membership_read on public.clinic_memberships;
create policy membership_read on public.clinic_memberships for select to authenticated using(user_id=auth.uid() or private.has_permission(clinic_id,'members.read'));
