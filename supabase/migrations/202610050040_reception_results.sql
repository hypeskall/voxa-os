-- Reception may consult every result state, but cannot author, validate or
-- release the doctor's report. Uploaded originals use the existing document
-- workflow and its patient visibility flag.
insert into public.role_permissions(role,permission)
values ('RECEPTION','results.read') on conflict do nothing;

create or replace function private.can_manage_result(cid uuid,did uuid,permission_key text) returns boolean
language sql stable security definer set search_path='' as $$
 select private.has_permission(cid,permission_key) and (
  exists(select 1 from public.clinic_memberships m where m.clinic_id=cid and m.user_id=auth.uid() and m.active and m.role in ('OWNER','ADMIN'))
  or (permission_key='results.read' and exists(select 1 from public.clinic_memberships m where m.clinic_id=cid and m.user_id=auth.uid() and m.active and m.role='RECEPTION'))
  or exists(select 1 from public.doctor_locations d where d.id=did and d.clinic_id=cid and d.staff_user_id=auth.uid() and d.active and d.archived_at is null)
 )
$$;

create function public.list_patient_result_uploads(cid uuid,pid uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.require_mfa();
 select coalesce(jsonb_agg(item order by item->>'created_at' desc),'[]'::jsonb) into result
 from jsonb_array_elements(public.list_patient_documents(cid,pid)) item
 join public.patient_documents d on d.id=(item->>'id')::uuid and d.clinic_id=cid and d.patient_id=pid
 join public.document_types t on t.id=d.document_type_id and t.clinic_id=d.clinic_id
 where t.code='result';
 return result;
end
$$;
-- Delegation to the existing document RPC preserves its current MFA,
-- subscription, workflow-patient and visible-to-patient authorization gates.
revoke all on function public.list_patient_result_uploads(uuid,uuid) from public,anon;
grant execute on function public.list_patient_result_uploads(uuid,uuid) to authenticated;
