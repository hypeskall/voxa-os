-- Install before connecting the private scanner; activate only after hosted
-- clean/EICAR/unavailable tests and scanning the existing medical objects.
create table private.upload_security(id boolean primary key default true check(id),required boolean not null default false);
insert into private.upload_security values(true,false);
create table private.medical_file_scans(
 object_path text primary key,
 plaintext_sha256 text not null check(plaintext_sha256 ~ '^[a-f0-9]{64}$'),
 ciphertext_sha256 text not null check(ciphertext_sha256 ~ '^[a-f0-9]{64}$'),
 definitions_updated_at timestamptz not null,
 checked_at timestamptz not null default now()
);
alter table private.upload_security enable row level security;
alter table private.medical_file_scans enable row level security;
revoke all on private.upload_security,private.medical_file_scans from public,anon,authenticated;
grant select,insert,update,delete on private.upload_security,private.medical_file_scans to service_role;
create function public.record_medical_file_scan(object_name text,plaintext_sha256 text,ciphertext_sha256 text,definitions_updated_at timestamptz) returns void language plpgsql security definer set search_path='' as $$
begin
 if object_name !~ '^[0-9a-f-]{36}/.*\.enc$' or not exists(select 1 from storage.objects where bucket_id='voxa-medical' and name=object_name)
  or definitions_updated_at<now()-interval '48 hours' or definitions_updated_at>now()+interval '5 minutes' then raise exception 'Invalid scan attestation'; end if;
 insert into private.medical_file_scans values(object_name,plaintext_sha256,ciphertext_sha256,definitions_updated_at,now())
 on conflict(object_path) do update set plaintext_sha256=excluded.plaintext_sha256,ciphertext_sha256=excluded.ciphertext_sha256,definitions_updated_at=excluded.definitions_updated_at,checked_at=excluded.checked_at;
end $$;
revoke all on function public.record_medical_file_scan(text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.record_medical_file_scan(text,text,text,timestamptz) to service_role;
create function private.require_clean_medical_object(object_name text) returns void language plpgsql stable security definer set search_path='' as $$
begin
 if object_name is not null and (select required from private.upload_security where id)
  and not exists(select 1 from private.medical_file_scans where object_path=object_name) then
   raise exception 'Antivirus verification required' using errcode='42501';
 end if;
end $$;
revoke all on function private.require_clean_medical_object(text) from public,anon,authenticated;
-- Prevent registration through direct RPCs as well as application uploads.
do $$ declare f record; body text; guard text; begin
 for f in select p.oid,p.proname,p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('save_patient_document','set_doctor_credentials','transition_medical_result') loop
  guard=case f.proname when 'save_patient_document' then 'perform private.require_clean_medical_object(path);'
   when 'set_doctor_credentials' then 'perform private.require_clean_medical_object(signature_path); perform private.require_clean_medical_object(stamp_path);'
   else 'perform private.require_clean_medical_object(pdf_path);' end;
  body=regexp_replace(f.prosrc,'\mBEGIN\M',E'BEGIN\n '||guard,'i');
  if body=f.prosrc then raise exception 'Scan guard could not be applied'; end if;
  execute replace(pg_get_functiondef(f.oid),f.prosrc,body);
 end loop;
end $$;
notify pgrst,'reload schema';
