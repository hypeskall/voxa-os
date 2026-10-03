create function private.workflow_patient(cid uuid,pid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.patients p where p.id=pid and p.clinic_id=cid)
 and (private.has_permission(cid,'patients.read') or
 (private.has_permission(cid,'clinic.read') and exists(select 1 from public.appointments a join public.doctor_locations dl on dl.id=a.doctor_location_id and dl.clinic_id=a.clinic_id
 where a.clinic_id=cid and a.patient_id=pid and dl.staff_user_id=auth.uid() and dl.active and dl.archived_at is null)))
$$;
-- These boolean helpers are evaluated by RLS as the authenticated caller.
-- Neither exposes medical contents and the private schema is not an API schema.
grant execute on function private.is_patient_for(uuid,uuid),private.can_manage_result(uuid,uuid,text) to authenticated;
drop policy patient_documents_staff_read on public.patient_documents;
create policy patient_documents_staff_read on public.patient_documents for select to authenticated
 using(private.has_permission(clinic_id,'documents.read') and private.workflow_patient(clinic_id,patient_id));
drop policy results_staff_read on public.medical_results;
create policy results_staff_read on public.medical_results for select to authenticated
 using(private.can_manage_result(clinic_id,doctor_location_id,'results.read'));
drop policy result_versions_staff_read on public.medical_result_versions;
create policy result_versions_staff_read on public.medical_result_versions for select to authenticated using
 (exists(select 1 from public.medical_results r where r.id=result_id and r.clinic_id=medical_result_versions.clinic_id and private.can_manage_result(r.clinic_id,r.doctor_location_id,'results.read')));
drop policy read_rows on public.doctor_credentials;
create policy read_rows on public.doctor_credentials for select to authenticated using(private.can_manage_result(clinic_id,doctor_location_id,'credentials.manage'));
-- A permission on a clinic is insufficient: the target patient/affiliation
-- must be in that clinic, and doctors only reach their clinical workflow.
create or replace function public.can_access_medical_object(object_name text,access_mode text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare cid uuid; pid uuid; did uuid; rid uuid; area text;
begin
 if access_mode not in ('read','write') or array_length(string_to_array(object_name,'/'),1)<4 then return false; end if;
 begin cid=split_part(object_name,'/',1)::uuid; exception when others then return false; end;
 if split_part(object_name,'/',2)='doctors' then
  if split_part(object_name,'/',4) not in ('signature','stamp') or array_length(string_to_array(object_name,'/'),1)<>5 then return false; end if;
  begin did=split_part(object_name,'/',3)::uuid; exception when others then return false; end;
  return private.has_permission(cid,'credentials.manage') and exists(select 1 from public.doctor_locations dl where dl.id=did and dl.clinic_id=cid and dl.active and dl.archived_at is null
   and (private.has_permission(cid,'catalog.manage') or dl.staff_user_id=auth.uid()));
 end if;
 begin pid=split_part(object_name,'/',2)::uuid; exception when others then return false; end;
 area=split_part(object_name,'/',3);
 if not exists(select 1 from public.patients where id=pid and clinic_id=cid) then return false; end if;
 if area='results' then
  if array_length(string_to_array(object_name,'/'),1)<>5 then return false; end if;
  begin rid=split_part(object_name,'/',4)::uuid; exception when others then return false; end;
  return exists(select 1 from public.medical_results r where r.id=rid and r.clinic_id=cid and r.patient_id=pid
   and (private.can_manage_result(cid,r.doctor_location_id,case when access_mode='write' then 'results.release' else 'results.read' end)
   or (access_mode='read' and r.pdf_object_path=object_name and r.status='RELEASED' and private.is_patient_for(cid,pid))));
 end if;
 if access_mode='write' then
  return area='documents' and array_length(string_to_array(object_name,'/'),1)=4 and private.workflow_patient(cid,pid) and private.has_permission(cid,'documents.manage');
 end if;
 if area='documents' then
  return (private.has_permission(cid,'documents.read') and private.workflow_patient(cid,pid)) or exists(select 1 from public.patient_documents d where d.object_path=object_name and d.clinic_id=cid and d.patient_id=pid and d.visible_to_patient and d.archived_at is null and private.is_patient_for(cid,pid));
 end if;
 return false;
end $$;

-- Compensation can remove unregistered uploads. Referenced medical objects
-- require an explicit retention/deletion workflow, never a casual DELETE.
create function public.can_delete_unregistered_medical_object(object_name text) returns boolean language sql stable security definer set search_path='' as $$
 select public.can_access_medical_object(object_name,'write')
 and not exists(select 1 from public.patient_documents where object_path=object_name)
 and not exists(select 1 from public.medical_results where pdf_object_path=object_name)
 and not exists(select 1 from public.doctor_credentials where signature_object_path=object_name or stamp_object_path=object_name)
$$;
revoke all on function public.can_delete_unregistered_medical_object(text) from public,anon;
grant execute on function public.can_delete_unregistered_medical_object(text) to authenticated;
do $$ begin if to_regclass('storage.objects') is not null then
 -- Registered originals must not be silently overwritten by a crafted PUT.
 execute 'drop policy if exists voxa_medical_update on storage.objects';
 execute $policy$create policy voxa_medical_orphan_delete on storage.objects for delete to authenticated using(bucket_id='voxa-medical' and public.can_delete_unregistered_medical_object(name))$policy$;
end if;end $$;

create table public.patient_notes (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, clinic_id uuid not null, patient_id uuid not null,
 author_id uuid not null references public.profiles(id), content text not null check(length(trim(content)) between 1 and 10000),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(clinic_id,organization_id) references public.clinics(id,organization_id), foreign key(patient_id,clinic_id) references public.patients(id,clinic_id)
);
create index patient_notes_patient on public.patient_notes(clinic_id,patient_id,created_at desc);
alter table public.patient_notes enable row level security;
create policy notes_read on public.patient_notes for select to authenticated using(private.workflow_patient(clinic_id,patient_id));
grant select on public.patient_notes to authenticated;
create function public.add_patient_note(cid uuid,pid uuid,note_content text) returns uuid language plpgsql security definer set search_path='' as $$
declare nid uuid; oid uuid;
begin
 if not private.workflow_patient(cid,pid) or not (private.has_permission(cid,'patients.manage') or private.has_permission(cid,'results.manage')) then raise exception 'Access denied' using errcode='42501'; end if;
 select organization_id into oid from public.clinics where id=cid;
 insert into public.patient_notes(organization_id,clinic_id,patient_id,author_id,content) values(oid,cid,pid,auth.uid(),trim(note_content)) returning id into nid;
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id) values(oid,cid,auth.uid(),'create','patient_notes',nid);
 return nid;
end $$;
create function public.read_workflow_patient(cid uuid,pid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.workflow_patient(cid,pid) then raise exception 'Access denied' using errcode='42501'; end if;
 return (select jsonb_build_object('id',id,'name',name,'birth_date',birth_date) from public.patients where id=pid and clinic_id=cid);
end $$;

create table public.privacy_requests (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null,clinic_id uuid not null,patient_id uuid not null,
 requested_by uuid not null references public.profiles(id),request_type text not null check(request_type in ('anonymization','erasure')),
 status text not null default 'pending_review' check(status in ('pending_review','approved','rejected','completed')),
 reason text not null check(length(trim(reason)) between 10 and 2000),review_note text not null default '' check(length(review_note)<=2000),
 reviewed_by uuid references public.profiles(id), created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(clinic_id,organization_id) references public.clinics(id,organization_id),foreign key(patient_id,clinic_id) references public.patients(id,clinic_id)
);
create index privacy_requests_clinic on public.privacy_requests(clinic_id,status,created_at desc);
alter table public.privacy_requests enable row level security;
create policy privacy_read on public.privacy_requests for select to authenticated using(private.has_permission(clinic_id,'organization.manage'));
grant select on public.privacy_requests to authenticated;
create trigger privacy_touch before update on public.privacy_requests for each row execute function private.touch_updated_at();
create function public.request_patient_privacy(cid uuid,pid uuid,kind text,reason_value text) returns uuid language plpgsql security definer set search_path='' as $$
declare oid uuid; rid uuid;
begin
 if not private.has_permission(cid,'organization.manage') or not private.workflow_patient(cid,pid) then raise exception 'Access denied' using errcode='42501'; end if;
 select organization_id into oid from public.clinics where id=cid;
 insert into public.privacy_requests(organization_id,clinic_id,patient_id,requested_by,request_type,reason) values(oid,cid,pid,auth.uid(),kind,reason_value) returning id into rid;
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id) values(oid,cid,auth.uid(),'privacy_requested','privacy_requests',rid);
 return rid;
end $$;
create function public.review_privacy_request(cid uuid,rid uuid,decision text,review text) returns void language plpgsql security definer set search_path='' as $$
declare oid uuid;
begin
 if not private.has_permission(cid,'organization.manage') then raise exception 'Access denied' using errcode='42501'; end if;
 if decision not in ('approved','rejected','completed') or length(trim(review))<10 then raise exception 'Review required'; end if;
 update public.privacy_requests set status=decision,review_note=review,reviewed_by=auth.uid()
 where id=rid and clinic_id=cid and ((status='pending_review' and decision in ('approved','rejected')) or (status='approved' and decision='completed')) returning organization_id into oid;
 if oid is null then raise exception 'Request unavailable'; end if;
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata) values(oid,cid,auth.uid(),'privacy_review','privacy_requests',rid,jsonb_build_object('status',decision));
end $$;
create function public.export_patient(cid uuid,pid uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare patient jsonb; oid uuid;
begin
 if not private.has_permission(cid,'organization.manage') or not private.workflow_patient(cid,pid) then raise exception 'Access denied' using errcode='42501'; end if;
 select to_jsonb(p),organization_id into patient,oid from public.patients p where id=pid and clinic_id=cid;
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id) values(oid,cid,auth.uid(),'export','patients',pid);
 return jsonb_build_object('patient',patient,
 'appointments',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from public.appointments a where clinic_id=cid and patient_id=pid),
 'notes',(select coalesce(jsonb_agg(to_jsonb(n)),'[]') from public.patient_notes n where clinic_id=cid and patient_id=pid),
 'documents',(select coalesce(jsonb_agg(to_jsonb(d)),'[]') from public.patient_documents d where clinic_id=cid and patient_id=pid),
 'results',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from public.medical_results r where clinic_id=cid and patient_id=pid),
 'communications',(select coalesce(jsonb_agg(to_jsonb(c)),'[]') from public.manual_patient_communications c where clinic_id=cid and patient_id=pid));
end $$;

-- Narrow doctor endpoint: no general appointments.read grant is added.
create function public.my_doctor_schedule(cid uuid,day_from date,day_to date) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.has_permission(cid,'clinic.read') or day_to<day_from or day_to-day_from>31 then raise exception 'Access denied' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(r) order by r.start_at),'[]') from (
 select a.id,a.start_at,a.end_at,a.status,a.patient_id,p.name as patient_name,s.name as service_name,a.notes
 from public.appointments a join public.doctor_locations dl on dl.id=a.doctor_location_id and dl.clinic_id=a.clinic_id
 join public.patients p on p.id=a.patient_id and p.clinic_id=a.clinic_id join public.services s on s.id=a.service_id and s.clinic_id=a.clinic_id
 join public.clinics c on c.id=a.clinic_id where a.clinic_id=cid and dl.staff_user_id=auth.uid() and dl.active and dl.archived_at is null
 and a.start_at>=(day_from::timestamp at time zone c.timezone) and a.start_at<((day_to+1)::timestamp at time zone c.timezone) order by a.start_at limit 500) r);
end $$;
revoke all on function private.workflow_patient(uuid,uuid) from public,anon;
grant execute on function private.workflow_patient(uuid,uuid) to authenticated;
revoke all on function public.read_workflow_patient(uuid,uuid),public.add_patient_note(uuid,uuid,text),public.request_patient_privacy(uuid,uuid,text,text),public.review_privacy_request(uuid,uuid,text,text),public.export_patient(uuid,uuid),public.my_doctor_schedule(uuid,date,date) from public,anon;
grant execute on function public.read_workflow_patient(uuid,uuid),public.add_patient_note(uuid,uuid,text),public.request_patient_privacy(uuid,uuid,text,text),public.review_privacy_request(uuid,uuid,text,text),public.export_patient(uuid,uuid),public.my_doctor_schedule(uuid,date,date) to authenticated;

-- Scope existing medical RPCs to the doctor's actual workflow. Preserve their
-- public signatures and the portal's released/visible-only access.
create or replace function public.list_patient_documents(cid uuid,pid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not ((private.has_permission(cid,'documents.read') and private.workflow_patient(cid,pid)) or private.is_patient_for(cid,pid)) then raise exception 'Access denied' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'title',d.title,'type_name',t.name,'file_name',d.file_name,'mime_type',d.mime_type,'file_size',d.file_size,'visible_to_patient',d.visible_to_patient,'appointment_id',d.appointment_id,'created_at',d.created_at) order by d.created_at desc)
  from public.patient_documents d join public.document_types t on t.id=d.document_type_id and t.clinic_id=d.clinic_id
  where d.clinic_id=cid and d.patient_id=pid and d.archived_at is null and ((private.has_permission(cid,'documents.read') and private.workflow_patient(cid,pid)) or d.visible_to_patient)),'[]');
end $$;
create or replace function public.save_patient_document(cid uuid,pid uuid,aid uuid,type_id uuid,document_title text,path text,file_label text,mime text,bytes bigint,patient_visible boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare oid uuid; document_id uuid; begin
 if not private.workflow_patient(cid,pid) or not private.has_permission(cid,'documents.manage') then raise exception 'Access denied' using errcode='42501'; end if;
 select organization_id into oid from public.patients where id=pid and clinic_id=cid;
 if oid is null or path not like cid::text||'/'||pid::text||'/documents/%' or not exists(select 1 from public.document_types where id=type_id and clinic_id=cid and active) then raise exception 'Invalid document'; end if;
 if aid is not null and not exists(select 1 from public.appointments where id=aid and clinic_id=cid and patient_id=pid) then raise exception 'Invalid appointment'; end if;
 insert into public.patient_documents(organization_id,clinic_id,patient_id,appointment_id,document_type_id,title,object_path,file_name,mime_type,file_size,visible_to_patient,created_by,uploaded_by)
 values(oid,cid,pid,aid,type_id,trim(document_title),path,file_label,mime,bytes,patient_visible,auth.uid(),auth.uid()) returning id into document_id;
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata) values(oid,cid,auth.uid(),'document_uploaded','patient_documents',document_id,jsonb_build_object('patient_id',pid,'mime_type',mime,'size',bytes));
 return document_id;
end $$;
create or replace function public.authorize_document_download(cid uuid,document_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; oid uuid; pid uuid; begin
 select d.organization_id,d.patient_id,jsonb_build_object('path',d.object_path,'file_name',d.file_name,'mime_type',d.mime_type) into oid,pid,result from public.patient_documents d
 where d.id=document_id and d.clinic_id=cid and d.archived_at is null and ((private.has_permission(cid,'documents.read') and private.workflow_patient(cid,d.patient_id)) or (d.visible_to_patient and private.is_patient_for(cid,d.patient_id)));
 if result is null then raise exception 'Access denied' using errcode='42501'; end if;
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata) values(oid,cid,auth.uid(),'document_downloaded','patient_documents',document_id,jsonb_build_object('patient_id',pid));
 return result;
end $$;
create or replace function public.list_medical_results(cid uuid,pid uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not (private.has_permission(cid,'results.read') or (pid is not null and private.is_patient_for(cid,pid))) then raise exception 'Access denied' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
  select r.id,r.patient_id,p.name patient_name,r.appointment_id,r.service_id,s.name service_name,r.doctor_location_id,d.name doctor_name,r.title,r.status,r.version,r.pdf_object_path,r.validated_at,r.released_at,r.created_at,r.updated_at
  from public.medical_results r join public.patients p on p.id=r.patient_id and p.clinic_id=r.clinic_id join public.services s on s.id=r.service_id and s.clinic_id=r.clinic_id
  join public.clinic_doctors d on d.id=r.doctor_location_id and d.clinic_id=r.clinic_id
  where r.clinic_id=cid and (pid is null or r.patient_id=pid) and (private.can_manage_result(cid,r.doctor_location_id,'results.read') or (r.status='RELEASED' and private.is_patient_for(cid,r.patient_id)))
 ) x),'[]');
end $$;
create or replace function public.read_medical_result(cid uuid,result_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; begin
 select to_jsonb(x) into result from (
  select r.*,p.name patient_name,p.internal_id patient_internal_id,p.birth_date,s.name service_name,d.name doctor_name,d.professional_code,c.name clinic_name,c.address clinic_address,c.phone clinic_phone,c.timezone
  from public.medical_results r join public.patients p on p.id=r.patient_id and p.clinic_id=r.clinic_id join public.services s on s.id=r.service_id and s.clinic_id=r.clinic_id
  join public.clinic_doctors d on d.id=r.doctor_location_id and d.clinic_id=r.clinic_id join public.clinics c on c.id=r.clinic_id
  where r.id=result_id and r.clinic_id=cid and (private.can_manage_result(cid,r.doctor_location_id,'results.read') or (r.status='RELEASED' and private.is_patient_for(cid,r.patient_id)))
 ) x;
 if result is null then raise exception 'Access denied' using errcode='42501'; end if; return result;
end $$;
create or replace function public.authorize_result_download(cid uuid,result_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; item public.medical_results; begin
 select * into item from public.medical_results where id=result_id and clinic_id=cid and pdf_object_path is not null and (private.can_manage_result(cid,doctor_location_id,'results.read') or (status='RELEASED' and private.is_patient_for(cid,patient_id)));
 if item.id is null then raise exception 'Access denied' using errcode='42501'; end if;
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata) values(item.organization_id,cid,auth.uid(),'result_downloaded','medical_results',result_id,jsonb_build_object('patient_id',item.patient_id,'version',item.version));
 return jsonb_build_object('path',item.pdf_object_path,'file_name','rezultat-'||result_id||'.pdf','mime_type','application/pdf');
end $$;
create or replace function public.set_doctor_credentials(cid uuid,did uuid,staff_uid uuid,signature_path text,signature_type text,stamp_path text,stamp_type text) returns void
language plpgsql security definer set search_path='' as $$
declare oid uuid; allowed boolean; begin
 select organization_id into oid from public.doctor_locations where id=did and clinic_id=cid;
 allowed=private.has_permission(cid,'credentials.manage') and (exists(select 1 from public.clinic_memberships where clinic_id=cid and user_id=auth.uid() and active and role in ('OWNER','ADMIN')) or exists(select 1 from public.doctor_locations d where d.id=did and d.clinic_id=cid and d.staff_user_id=auth.uid() and d.active and d.archived_at is null));
 if oid is null or not allowed then raise exception 'Access denied' using errcode='42501'; end if;
 if signature_path is not null and (not public.can_access_medical_object(signature_path,'write') or split_part(signature_path,'/',1)<>cid::text or split_part(signature_path,'/',3)<>did::text or split_part(signature_path,'/',4)<>'signature') then raise exception 'Invalid signature'; end if;
 if stamp_path is not null and (not public.can_access_medical_object(stamp_path,'write') or split_part(stamp_path,'/',1)<>cid::text or split_part(stamp_path,'/',3)<>did::text or split_part(stamp_path,'/',4)<>'stamp') then raise exception 'Invalid stamp'; end if;
 if staff_uid is not null and not private.has_permission(cid,'catalog.manage') and staff_uid<>auth.uid() then raise exception 'Access denied' using errcode='42501'; end if;
 if staff_uid is not null and not exists(select 1 from public.clinic_memberships where clinic_id=cid and user_id=staff_uid and active and role='DOCTOR') then raise exception 'Invalid doctor account'; end if;
 update public.doctor_locations set staff_user_id=coalesce(staff_uid,staff_user_id) where id=did and clinic_id=cid;
 insert into public.doctor_credentials(doctor_location_id,clinic_id,organization_id,signature_object_path,stamp_object_path,signature_mime,stamp_mime,updated_by)
 values(did,cid,oid,signature_path,stamp_path,signature_type,stamp_type,auth.uid()) on conflict(doctor_location_id) do update set
  signature_object_path=coalesce(excluded.signature_object_path,public.doctor_credentials.signature_object_path),stamp_object_path=coalesce(excluded.stamp_object_path,public.doctor_credentials.stamp_object_path),
  signature_mime=coalesce(excluded.signature_mime,public.doctor_credentials.signature_mime),stamp_mime=coalesce(excluded.stamp_mime,public.doctor_credentials.stamp_mime),updated_by=auth.uid(),updated_at=now();
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata) values(oid,cid,auth.uid(),'doctor_credentials_updated','doctor_locations',did,jsonb_build_object('signature_changed',signature_path is not null,'stamp_changed',stamp_path is not null,'staff_link_changed',staff_uid is not null));
end $$;
create or replace function public.read_doctor_credentials(cid uuid,did uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.can_manage_result(cid,did,'credentials.manage') then raise exception 'Access denied' using errcode='42501'; end if;
 return coalesce((select jsonb_build_object('staff_user_id',d.staff_user_id,'signature_object_path',c.signature_object_path,'signature_mime',c.signature_mime,'stamp_object_path',c.stamp_object_path,'stamp_mime',c.stamp_mime)
  from public.doctor_locations d left join public.doctor_credentials c on c.doctor_location_id=d.id where d.id=did and d.clinic_id=cid),'{}');
end $$;
