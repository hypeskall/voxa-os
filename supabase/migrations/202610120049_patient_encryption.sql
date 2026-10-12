-- Installation is deliberately separate from activation. Activation needs an
-- externally held key, a verified backup and a coordinated application release.
-- Hosted default privileges had granted unnecessary access to this read view.
revoke all on public.clinic_doctors from public,anon,authenticated,service_role;
grant select on public.clinic_doctors to authenticated,service_role;
create table private.patient_encryption_config (
 singleton boolean primary key default true check(singleton), activated_at timestamptz,
 active_key_id text, index_fingerprint text
);
insert into private.patient_encryption_config(singleton) values(true);
create table private.patient_encryption_tables (
 table_name text primary key, masks jsonb not null, checks_sql text[] not null default '{}'
);
insert into private.patient_encryption_tables(table_name,masks) values
 ('patients','{"name":"[encrypted]","internal_id":"[encrypted]","birth_date":null,"sex":"unspecified","phone":"","email":"","address":"","city":"","postal_code":"","country":"","administrative_notes":"","cnp":null}'),
 ('patient_notes','{"content":"[encrypted]"}'),
 ('medical_results','{"title":"[encrypted]","content":""}'),
 ('medical_result_versions','{"title":"[encrypted]","content":"","change_reason":""}'),
 ('patient_documents','{"title":"[encrypted]","file_name":"[encrypted]"}'),
 ('appointments','{"notes":"","cancellation_reason":""}'),
 ('appointment_history','{"old_values":{},"new_values":{},"reason":""}'),
 ('notification_jobs','{"recipient":"[encrypted]","last_error":""}'),
 ('communication_logs','{"recipient_masked":"[encrypted]","last_error":""}'),
 ('manual_patient_communications','{"summary":"[encrypted]"}'),
 ('privacy_requests','{"reason":"[encrypted]","review_note":""}'),
 ('reception_work','{"title":"[encrypted]","notes":""}');
revoke all on private.patient_encryption_config,private.patient_encryption_tables from public,anon,authenticated,service_role;

-- Keys arrive only on server-to-PostgREST requests. They are never persisted in
-- a table, Vault, migration, JWT, backup or function definition.
create function private.patient_keyring() returns jsonb language plpgsql stable set search_path='' as $$
declare ring jsonb;
begin
 begin
  ring := (nullif(current_setting('request.headers',true),'')::jsonb->>'x-voxa-patient-keyring')::jsonb;
 exception when others then raise exception 'Patient encryption key unavailable' using errcode='42501'; end;
 if ring is null or ring->>'active' !~ '^[a-zA-Z0-9_-]{1,40}$'
  or coalesce(ring->'keys'->>(ring->>'active'),'') !~ '^[a-f0-9]{64}$'
  or coalesce(ring->>'index','') !~ '^[a-f0-9]{64}$' then
  raise exception 'Patient encryption key unavailable' using errcode='42501';
 end if;
 return ring;
end $$;

create function private.open_patient_payload(cipher bytea,key_id text,table_name text,cid uuid,row_id uuid)
returns jsonb language plpgsql stable set search_path='' as $$
declare ring jsonb; envelope jsonb; secret text;
begin
 ring := private.patient_keyring(); secret := ring->'keys'->>key_id;
 if coalesce(secret,'') !~ '^[a-f0-9]{64}$' then raise exception 'Patient encryption key unavailable' using errcode='42501'; end if;
 begin
  envelope := extensions.pgp_sym_decrypt(cipher,secret)::jsonb;
 exception when others then raise exception 'Patient encryption integrity check failed' using errcode='22000'; end;
 if envelope->>'context' is distinct from table_name||'/'||cid||'/'||row_id then
  raise exception 'Patient encryption integrity check failed' using errcode='22000';
 end if;
 return envelope->'values';
end $$;

-- Invoker privileges are essential: views and their mutation triggers retain
-- the original table RLS, MFA policies, grants, foreign keys and identities.
create function private.seal_patient_row() returns trigger language plpgsql set search_path='' as $$
declare ring jsonb; masks jsonb; doc jsonb; values_doc jsonb; field text; expression text; valid boolean; fingerprint text;
begin
 ring := private.patient_keyring();
 select t.masks into masks from private.patient_encryption_tables t where table_name=tg_table_name;
 doc := to_jsonb(new);
 -- Validate the original CHECK constraints against the plaintext input before
 -- masking. The physical table subsequently enforces its constraints and FKs.
 for expression in select unnest(checks_sql) from private.patient_encryption_tables where table_name=tg_table_name loop
  execute format('select (%s) is not false from jsonb_populate_record(null::private.%I,$1) r',expression,tg_table_name) into valid using doc;
  if not valid then raise exception 'Invalid protected patient field' using errcode='23514'; end if;
 end loop;
 select coalesce(jsonb_object_agg(k,doc->k),'{}') into values_doc from jsonb_object_keys(masks) k;
 if tg_table_name='patients' then
  fingerprint := encode(extensions.digest(decode(ring->>'index','hex'),'sha256'),'hex');
  if fingerprint is distinct from (select index_fingerprint from private.patient_encryption_config where singleton) then
   raise exception 'Patient encryption index key mismatch' using errcode='42501';
  end if;
  -- A separate, stable HMAC key preserves uniqueness across data-key rotation.
  masks := masks || jsonb_build_object('internal_id',left(encode(extensions.hmac(convert_to(new.clinic_id::text||'/'||(doc->>'internal_id'),'UTF8'),decode(ring->>'index','hex'),'sha256'),'hex'),40));
  new.patient_blind_cnp := case when doc->>'cnp' is null then null else encode(extensions.hmac(convert_to(new.clinic_id::text||'/'||(doc->>'cnp'),'UTF8'),decode(ring->>'index','hex'),'sha256'),'hex') end;
 end if;
 new := jsonb_populate_record(new,masks);
 new.patient_key_id := ring->>'active';
 new.patient_ciphertext := extensions.pgp_sym_encrypt(
  jsonb_build_object('context',tg_table_name||'/'||new.clinic_id||'/'||new.id,'values',values_doc)::text,
  ring->'keys'->>(ring->>'active'),'cipher-algo=aes256,compress-algo=1');
 return new;
end $$;

create function private.write_patient_view() returns trigger language plpgsql set search_path='' as $$
declare result jsonb; columns_sql text; assignments text;
begin
 if tg_op='DELETE' then
  execute format('delete from private.%I where id=$1',tg_table_name) using old.id;
  return old;
 end if;
 select string_agg(format('%I',a.attname),',' order by a.attnum),
        string_agg(format('%I=r.%I',a.attname,a.attname),',' order by a.attnum)
 into columns_sql,assignments from pg_attribute a
 where a.attrelid=tg_relid and a.attnum>0 and not a.attisdropped;
 if tg_op='INSERT' then
  execute format('insert into private.%1$I(%2$s) select %2$s from jsonb_populate_record(null::public.%1$I,$1) r',tg_table_name,columns_sql) using to_jsonb(new);
 else
  execute format('update private.%1$I t set %2$s from jsonb_populate_record(null::public.%1$I,$1) r where t.id=$2',tg_table_name,assignments) using to_jsonb(new),old.id;
 end if;
 execute format('select to_jsonb(t) from public.%I t where id=$1',tg_table_name) into result using new.id;
 return jsonb_populate_record(new,result);
end $$;
revoke all on function private.patient_keyring(),private.open_patient_payload(bytea,text,text,uuid,uuid),private.seal_patient_row(),private.write_patient_view() from public,anon,authenticated;

create function public.activate_patient_encryption() returns jsonb language plpgsql security definer set search_path='' as $$
declare ring jsonb; item record; column_info record; select_sql text; definition text; fn record; changed integer; total integer:=0;
begin
 -- ACL plus caller-role check; a staff JWT never suffices.
 if coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb->>'role' is distinct from 'service_role'
  and current_setting('role',true) is distinct from 'service_role' then raise exception 'Operator access required' using errcode='42501'; end if;
 ring := private.patient_keyring();
 if (select activated_at from private.patient_encryption_config where singleton) is not null then
  raise exception 'Patient encryption already active';
 end if;
 execute 'create schema if not exists extensions';
 execute 'create extension if not exists pgcrypto with schema extensions';
 if to_regprocedure('extensions.pgp_sym_encrypt(text,text,text)') is null then raise exception 'pgcrypto must be installed in extensions'; end if;
 update private.patient_encryption_config set active_key_id=ring->>'active',
  index_fingerprint=encode(extensions.digest(decode(ring->>'index','hex'),'sha256'),'hex') where singleton;
 for item in select * from private.patient_encryption_tables order by table_name loop
  execute format('lock table public.%I in access exclusive mode',item.table_name);
  update private.patient_encryption_tables set checks_sql=coalesce((select array_agg(pg_get_expr(conbin,conrelid)) from pg_constraint where conrelid=format('public.%I',item.table_name)::regclass and contype='c'),'{}') where table_name=item.table_name;
  select string_agg(case when item.masks ? a.attname then
   format('(d.values->>%L)::%s as %I',a.attname,format_type(a.atttypid,a.atttypmod),a.attname)
   else format('t.%I',a.attname) end,',' order by a.attnum)
  into select_sql from pg_attribute a where a.attrelid=format('public.%I',item.table_name)::regclass and a.attnum>0 and not a.attisdropped;
  -- JSON objects must retain JSON types, rather than becoming JSON strings.
  select_sql := replace(select_sql,'->>''old_values'')::jsonb','->''old_values'')::jsonb');
  select_sql := replace(select_sql,'->>''new_values'')::jsonb','->''new_values'')::jsonb');
  execute format('alter table public.%I set schema private',item.table_name);
  execute format('alter table private.%I add column patient_ciphertext bytea,add column patient_key_id text,add column patient_blind_cnp text',item.table_name);
  execute format('create view public.%1$I with (security_invoker=true,security_barrier=true) as select %2$s from private.%1$I t cross join lateral private.open_patient_payload(t.patient_ciphertext,t.patient_key_id,%3$L,t.clinic_id,t.id) d(values)',item.table_name,select_sql,item.table_name);
  -- Hosted Supabase can have permissive default ACLs for newly created views.
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',item.table_name);
  -- Copy every default, including UUIDs, enum values and timestamps.
  for column_info in select a.attname,pg_get_expr(d.adbin,d.adrelid) expr from pg_attribute a join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=format('private.%I',item.table_name)::regclass loop
   execute format('alter view public.%I alter column %I set default %s',item.table_name,column_info.attname,column_info.expr);
  end loop;
  execute format('create trigger write_patient_view instead of insert or update or delete on public.%I for each row execute function private.write_patient_view()',item.table_name);
  execute format('create trigger zz_seal_patient before insert or update on private.%I for each row execute function private.seal_patient_row()',item.table_name);
  -- Backfill without firing clinical/audit/notification side effects.
  execute format('alter table private.%I disable trigger user',item.table_name);
  execute format('alter table private.%I enable trigger zz_seal_patient',item.table_name);
  execute format('update private.%I set id=id',item.table_name);
  get diagnostics changed=row_count; total:=total+changed;
  execute format('alter table private.%I enable trigger user',item.table_name);
  execute format('alter table private.%I alter column patient_ciphertext set not null,alter column patient_key_id set not null',item.table_name);
  -- SELECT grants stay narrow; writes still go through existing authorized RPCs.
  execute format('grant select on public.%I to authenticated,service_role',item.table_name);
  execute format('grant select,insert,update,delete on private.%I to service_role',item.table_name);
 end loop;
 -- Core patients alone already allowed direct writes under RLS.
 grant insert,update on public.patients to authenticated;
 grant usage on schema private,extensions to authenticated,service_role;
 -- Registry/config cannot be modified by application roles.
 revoke all on private.patient_encryption_config,private.patient_encryption_tables from service_role;
 create unique index patients_encrypted_cnp_per_clinic on private.patients(clinic_id,patient_blind_cnp) where patient_blind_cnp is not null;
 -- PostgreSQL binds composite argument types to table OIDs. The scheduling
 -- snapshot helper needs an overload for the replacement plaintext view type.
 select pg_get_functiondef('private.appointment_snapshot(private.appointments)'::regprocedure) into definition;
 execute replace(definition,'a private.appointments','a public.appointments');
 revoke all on function private.appointment_snapshot(public.appointments) from public,anon,authenticated;
 -- ON CONFLICT requires the physical table. Its BEFORE trigger encrypts inputs.
 for fn in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','public') and p.prokind='f' and p.prosrc like '%insert into public.notification_jobs%' loop
  definition := pg_get_functiondef(fn.oid);
  execute replace(definition,'insert into public.notification_jobs','insert into private.notification_jobs');
 end loop;
 -- This AFTER trigger needs the original history status for notification routing.
 select pg_get_functiondef('private.appointment_communication_event()'::regprocedure) into definition;
 definition := replace(definition,'new.new_values->>''status''','(private.open_patient_payload(new.patient_ciphertext,new.patient_key_id,''appointment_history'',new.clinic_id,new.id)->''new_values'')->>''status''');
 execute definition;
 -- Storage requests must never carry the master key. Its authorization helpers
 -- need only structural IDs, paths, status and visibility, so read those from
 -- the masked physical tables while retaining the existing permission checks.
 for fn in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','public') and p.prokind='f' and p.proname in ('workflow_patient','can_access_medical_object','can_delete_unregistered_medical_object') loop
  definition := pg_get_functiondef(fn.oid);
  definition := replace(replace(replace(replace(definition,'public.patients','private.patients'),'public.appointments','private.appointments'),'public.patient_documents','private.patient_documents'),'public.medical_results','private.medical_results');
  execute definition;
 end loop;
 -- Only these helpers need invoker access. The keyring itself never becomes an RPC.
 grant execute on function private.patient_keyring(),private.open_patient_payload(bytea,text,text,uuid,uuid),private.seal_patient_row(),private.write_patient_view() to authenticated,service_role;
 grant select on private.patient_encryption_tables,private.patient_encryption_config to authenticated,service_role;
 update private.patient_encryption_config set activated_at=now() where singleton;
 perform pg_notify('pgrst','reload schema');
 return jsonb_build_object('encrypted_rows',total,'tables',(select count(*) from private.patient_encryption_tables));
end $$;
revoke all on function public.activate_patient_encryption() from public,anon,authenticated;
grant execute on function public.activate_patient_encryption() to service_role;

create function public.patient_encryption_status() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb->>'role' is distinct from 'service_role'
  and current_setting('role',true) is distinct from 'service_role' then raise exception 'Operator access required' using errcode='42501'; end if;
 return (select jsonb_build_object('active',activated_at is not null,'activated_at',activated_at,'key_id',active_key_id) from private.patient_encryption_config where singleton);
end $$;
revoke all on function public.patient_encryption_status() from public,anon,authenticated;
grant execute on function public.patient_encryption_status() to service_role;

-- File migration changes only an existing reference within the same folder.
-- The operator first verifies the new ciphertext, then replaces references,
-- and only then removes the legacy object. No clinical content is returned.
create function public.replace_encrypted_medical_path(old_path text,new_path text) returns void language plpgsql security definer set search_path='' as $$
begin
 if coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb->>'role' is distinct from 'service_role'
  and current_setting('role',true) is distinct from 'service_role' then raise exception 'Operator access required' using errcode='42501'; end if;
 perform private.patient_keyring();
 if old_path is null or new_path is null or new_path !~ '/[a-f0-9-]{36}\.enc$'
  or regexp_replace(old_path,'/[^/]+$','') is distinct from regexp_replace(new_path,'/[^/]+$','') then raise exception 'Invalid encrypted object path'; end if;
 update public.patient_documents set object_path=new_path where object_path=old_path;
 update public.medical_results set pdf_object_path=new_path where pdf_object_path=old_path;
 update public.doctor_credentials set signature_object_path=new_path where signature_object_path=old_path;
 update public.doctor_credentials set stamp_object_path=new_path where stamp_object_path=old_path;
end $$;
revoke all on function public.replace_encrypted_medical_path(text,text) from public,anon,authenticated;
grant execute on function public.replace_encrypted_medical_path(text,text) to service_role;

-- Ciphertext has a bounded envelope overhead, while application validation
-- continues to limit the actual patient document to 20 MiB.
do $$ begin
 if to_regclass('storage.buckets') is not null then
  update storage.buckets set allowed_mime_types=array['application/pdf','image/png','image/jpeg','image/webp','application/octet-stream'],file_size_limit=20975616 where id='voxa-medical';
 end if;
end $$;
