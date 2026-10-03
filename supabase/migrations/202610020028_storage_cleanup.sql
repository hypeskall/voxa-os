-- Failed compensation is durable and visible to operators. Clinical originals
-- are never deleted as part of this queue; it contains only unregistered files.
create table public.storage_cleanup_jobs (
 id uuid primary key default gen_random_uuid(),
 bucket_id text not null check(bucket_id in ('voxa-medical','voxa-branding')),
 object_path text not null check(length(object_path) between 1 and 1024),
 requested_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 resolved_at timestamptz,
 unique(bucket_id,object_path)
);
alter table public.storage_cleanup_jobs enable row level security;
revoke all on public.storage_cleanup_jobs from public,anon,authenticated;
grant select,update on public.storage_cleanup_jobs to service_role;
create index storage_cleanup_pending on public.storage_cleanup_jobs(created_at) where resolved_at is null;

create function public.queue_storage_cleanup(bucket text,path text) returns uuid
language plpgsql security definer set search_path='' as $$
declare jid uuid; oid uuid;
begin
 if bucket='voxa-medical' then
  if not public.can_delete_unregistered_medical_object(path) then raise exception 'Access denied' using errcode='42501'; end if;
 elsif bucket='voxa-branding' then
  begin oid=split_part(path,'/',1)::uuid; exception when others then raise exception 'Invalid object'; end;
  if array_length(string_to_array(path,'/'),1)<>3 or split_part(path,'/',2)<>'logo'
   or not private.org_owner(oid) or exists(select 1 from public.organizations where logo_path=path)
   then raise exception 'Access denied' using errcode='42501'; end if;
 else raise exception 'Invalid bucket'; end if;
 insert into public.storage_cleanup_jobs(bucket_id,object_path,requested_by) values(bucket,path,auth.uid())
 on conflict(bucket_id,object_path) do update set resolved_at=null returning id into jid;
 return jid;
end $$;
revoke all on function public.queue_storage_cleanup(text,text) from public,anon;
grant execute on function public.queue_storage_cleanup(text,text) to authenticated;

-- Operator rechecks references immediately before any manual object removal.
-- Returns only a boolean, and is not available to browser roles.
create function public.storage_cleanup_unreferenced(job_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.storage_cleanup_jobs j where j.id=job_id and j.resolved_at is null
 and not exists(select 1 from public.patient_documents d where d.object_path=j.object_path)
 and not exists(select 1 from public.medical_results r where r.pdf_object_path=j.object_path)
 and not exists(select 1 from public.doctor_credentials c where c.signature_object_path=j.object_path or c.stamp_object_path=j.object_path)
 and not exists(select 1 from public.organizations o where o.logo_path=j.object_path))
$$;
revoke all on function public.storage_cleanup_unreferenced(uuid) from public,anon,authenticated;
grant execute on function public.storage_cleanup_unreferenced(uuid) to service_role;
