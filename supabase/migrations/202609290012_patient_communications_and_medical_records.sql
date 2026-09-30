-- Phase 6-8: appointment confirmation, notifications, private medical files,
-- versioned results and a patient-only identity boundary.
create type public.notification_channel as enum ('SMS','EMAIL');
create type public.notification_status as enum ('QUEUED','SENDING','SENT','DELIVERED','FAILED');
create type public.notification_event as enum (
 'APPOINTMENT_CREATED','CONFIRMATION_REQUESTED','APPOINTMENT_CONFIRMED',
 'APPOINTMENT_CHANGED','APPOINTMENT_CANCELLED','APPOINTMENT_REMINDER','RESULT_AVAILABLE'
);
create type public.medical_result_status as enum ('DRAFT','VALIDATED','RELEASED');

insert into public.permissions(key,description) values
 ('notifications.read','Vizualizare comunicări'),('notifications.manage','Configurare comunicări'),
 ('documents.read','Vizualizare documente pacient'),('documents.manage','Administrare documente pacient'),
 ('results.read','Vizualizare rezultate medicale'),('results.manage','Redactare rezultate medicale'),
 ('results.release','Validare și publicare rezultate'),('credentials.manage','Administrare semnătură și parafă');
insert into public.role_permissions
select r.role,p.key from public.permissions p
cross join (values('OWNER'::public.clinic_role),('ADMIN'::public.clinic_role)) r(role)
where p.key in ('notifications.read','notifications.manage','documents.read','documents.manage','results.read','results.manage','results.release','credentials.manage');
insert into public.role_permissions values
 ('RECEPTION','notifications.read'),('RECEPTION','documents.read'),('RECEPTION','documents.manage'),
 ('DOCTOR','documents.read'),('DOCTOR','documents.manage'),('DOCTOR','results.read'),('DOCTOR','results.manage'),('DOCTOR','results.release'),('DOCTOR','credentials.manage'),
 ('ASSISTANT','documents.read');

alter table public.clinics add column phone text not null default '' check(length(phone)<=40);
alter table public.services add column reminder_offsets_minutes integer[]
 check(reminder_offsets_minutes is null or reminder_offsets_minutes <@ array[120,1440,2880]);
alter table public.doctor_locations add column staff_user_id uuid references public.profiles(id);
create unique index doctor_location_staff_per_clinic on public.doctor_locations(clinic_id,staff_user_id) where staff_user_id is not null;
alter table public.doctor_credentials drop constraint doctor_credentials_signature_object_path_check;
alter table public.doctor_credentials drop constraint doctor_credentials_stamp_object_path_check;
alter table public.doctor_credentials
 add column signature_mime text check(signature_mime is null or signature_mime in ('image/png','image/jpeg','image/webp')),
 add column stamp_mime text check(stamp_mime is null or stamp_mime in ('image/png','image/jpeg','image/webp')),
 add column updated_by uuid references public.profiles(id),
 add column updated_at timestamptz not null default now();

create table public.clinic_notification_settings (
 clinic_id uuid primary key, organization_id uuid not null,
 sms_enabled boolean not null default false,email_enabled boolean not null default true,
 reminder_offsets_minutes integer[] not null default array[2880,1440,120]
  check(reminder_offsets_minutes <@ array[120,1440,2880]),
 confirmation_expiry_hours integer not null default 168 check(confirmation_expiry_hours between 1 and 720),
 cancellation_min_notice_hours integer not null default 2 check(cancellation_min_notice_hours between 0 and 720),
 updated_at timestamptz not null default now(),
 foreign key(clinic_id,organization_id) references public.clinics(id,organization_id)
);
create table public.communication_templates (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,clinic_id uuid not null,
 event public.notification_event not null,channel public.notification_channel not null,
 subject text not null default '' check(length(subject)<=200),body text not null check(length(body) between 1 and 4000),
 active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(clinic_id,organization_id) references public.clinics(id,organization_id),unique(clinic_id,event,channel)
);
create table public.appointment_confirmations (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,clinic_id uuid not null,appointment_id uuid not null,
 public_id uuid not null default gen_random_uuid(),token_hash text not null check(token_hash ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz not null,revoked_at timestamptz,used_at timestamptz,created_by uuid references public.profiles(id),created_at timestamptz not null default now(),
 foreign key(clinic_id,organization_id) references public.clinics(id,organization_id),
 foreign key(appointment_id,clinic_id) references public.appointments(id,clinic_id),unique(public_id),unique(token_hash)
);
create unique index one_active_confirmation on public.appointment_confirmations(appointment_id) where revoked_at is null;
create index confirmation_hash_lookup on public.appointment_confirmations(token_hash) where revoked_at is null;

create table public.notification_jobs (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,clinic_id uuid not null,
 event public.notification_event not null,channel public.notification_channel not null,status public.notification_status not null default 'QUEUED',
 appointment_id uuid,patient_id uuid,confirmation_id uuid,recipient text not null check(length(recipient) between 3 and 254),
 scheduled_for timestamptz not null default now(),idempotency_key text not null check(length(idempotency_key) between 8 and 250),
 attempts integer not null default 0 check(attempts between 0 and 20),max_attempts integer not null default 4 check(max_attempts between 1 and 20),
 locked_at timestamptz,sent_at timestamptz,provider_message_id text,last_error text not null default '' check(length(last_error)<=500),
 created_by uuid references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(clinic_id,organization_id) references public.clinics(id,organization_id),
 foreign key(appointment_id,clinic_id) references public.appointments(id,clinic_id),
 foreign key(patient_id,clinic_id) references public.patients(id,clinic_id),
 foreign key(confirmation_id) references public.appointment_confirmations(id),unique(idempotency_key)
);
create index notification_jobs_due on public.notification_jobs(status,scheduled_for) where status in ('QUEUED','FAILED');
create table public.communication_logs (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,clinic_id uuid not null,job_id uuid not null unique,
 event public.notification_event not null,channel public.notification_channel not null,status public.notification_status not null,
 appointment_id uuid,patient_id uuid,recipient_masked text not null,attempts integer not null default 0,
 provider_message_id text,last_error text not null default '' check(length(last_error)<=500),sent_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(clinic_id,organization_id) references public.clinics(id,organization_id),foreign key(job_id) references public.notification_jobs(id),
 foreign key(appointment_id,clinic_id) references public.appointments(id,clinic_id),foreign key(patient_id,clinic_id) references public.patients(id,clinic_id)
);
create index communication_patient_time on public.communication_logs(clinic_id,patient_id,created_at desc);

create table public.document_types (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,clinic_id uuid not null,
 name text not null check(length(trim(name)) between 2 and 100),code text not null check(code ~ '^[a-z0-9_]+$'),active boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(clinic_id,organization_id) references public.clinics(id,organization_id),unique(id,clinic_id),unique(clinic_id,code),unique(clinic_id,name)
);
create table public.patient_documents (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,clinic_id uuid not null,patient_id uuid not null,
 appointment_id uuid,document_type_id uuid not null,title text not null check(length(trim(title)) between 2 and 200),
 object_path text not null unique check(length(object_path)<=500),file_name text not null check(length(file_name)<=255),
 mime_type text not null check(mime_type in ('application/pdf','image/png','image/jpeg','image/webp')),
 file_size bigint not null check(file_size between 1 and 20971520),visible_to_patient boolean not null default false,
 created_by uuid references public.profiles(id),uploaded_by uuid references public.profiles(id),
 archived_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(clinic_id,organization_id) references public.clinics(id,organization_id),foreign key(patient_id,clinic_id) references public.patients(id,clinic_id),
 foreign key(appointment_id,clinic_id) references public.appointments(id,clinic_id),foreign key(document_type_id,clinic_id) references public.document_types(id,clinic_id),
 unique(id,clinic_id)
);
create index patient_documents_patient on public.patient_documents(clinic_id,patient_id,created_at desc) where archived_at is null;

create table public.medical_results (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,clinic_id uuid not null,patient_id uuid not null,
 appointment_id uuid not null,service_id uuid not null,doctor_location_id uuid not null,title text not null check(length(trim(title)) between 2 and 200),
 content text not null default '' check(length(content)<=100000),status public.medical_result_status not null default 'DRAFT',version integer not null default 1 check(version>0),
 pdf_object_path text unique,created_by uuid not null references public.profiles(id),validated_by uuid references public.profiles(id),released_by uuid references public.profiles(id),
 validated_at timestamptz,released_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(clinic_id,organization_id) references public.clinics(id,organization_id),foreign key(patient_id,clinic_id) references public.patients(id,clinic_id),
 foreign key(appointment_id,clinic_id) references public.appointments(id,clinic_id),foreign key(service_id,clinic_id) references public.services(id,clinic_id),
 foreign key(doctor_location_id,clinic_id) references public.doctor_locations(id,clinic_id),unique(id,clinic_id),unique(appointment_id)
);
create table public.medical_result_versions (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,clinic_id uuid not null,result_id uuid not null,
 version integer not null,status public.medical_result_status not null,title text not null,content text not null,
 changed_by uuid not null references public.profiles(id),change_reason text not null default '' check(length(change_reason)<=1000),created_at timestamptz not null default now(),
 foreign key(clinic_id,organization_id) references public.clinics(id,organization_id),foreign key(result_id,clinic_id) references public.medical_results(id,clinic_id),unique(result_id,version)
);
create index medical_results_patient on public.medical_results(clinic_id,patient_id,created_at desc);

create table public.patient_identities (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id),organization_id uuid not null,clinic_id uuid not null,patient_id uuid not null,
 verified_at timestamptz not null default now(),revoked_at timestamptz,created_by uuid references public.profiles(id),created_at timestamptz not null default now(),
 foreign key(clinic_id,organization_id) references public.clinics(id,organization_id),foreign key(patient_id,clinic_id) references public.patients(id,clinic_id),
 unique(user_id,clinic_id),unique(patient_id,user_id,clinic_id)
);
create index patient_identity_user on public.patient_identities(user_id,clinic_id) where revoked_at is null;

create function private.is_patient_for(cid uuid,pid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.patient_identities i where i.user_id=auth.uid() and i.clinic_id=cid and i.patient_id=pid and i.revoked_at is null)
$$;
create function private.can_manage_result(cid uuid,did uuid,permission_key text) returns boolean language sql stable security definer set search_path='' as $$
 select private.has_permission(cid,permission_key) and (
  exists(select 1 from public.clinic_memberships m where m.clinic_id=cid and m.user_id=auth.uid() and m.active and m.role in ('OWNER','ADMIN'))
  or exists(select 1 from public.doctor_locations d where d.id=did and d.clinic_id=cid and d.staff_user_id=auth.uid() and d.active and d.archived_at is null)
 )
$$;

do $$ declare t text; begin
 foreach t in array array['clinic_notification_settings','communication_templates','appointment_confirmations','notification_jobs','communication_logs','document_types','patient_documents','medical_results','medical_result_versions','patient_identities'] loop
  execute format('alter table public.%I enable row level security',t);
 end loop;
end $$;
create policy notification_settings_read on public.clinic_notification_settings for select to authenticated using(private.has_permission(clinic_id,'notifications.read'));
create policy templates_read on public.communication_templates for select to authenticated using(private.has_permission(clinic_id,'notifications.read'));
create policy jobs_read on public.notification_jobs for select to authenticated using(private.has_permission(clinic_id,'notifications.read'));
create policy logs_read on public.communication_logs for select to authenticated using(private.has_permission(clinic_id,'notifications.read'));
create policy confirmations_read on public.appointment_confirmations for select to authenticated using(private.has_permission(clinic_id,'appointments.manage'));
create policy document_types_read on public.document_types for select to authenticated using(private.has_permission(clinic_id,'documents.read'));
create policy patient_documents_staff_read on public.patient_documents for select to authenticated using(private.has_permission(clinic_id,'documents.read'));
create policy patient_documents_portal_read on public.patient_documents for select to authenticated using(visible_to_patient and archived_at is null and private.is_patient_for(clinic_id,patient_id));
create policy results_staff_read on public.medical_results for select to authenticated using(private.has_permission(clinic_id,'results.read'));
create policy results_portal_read on public.medical_results for select to authenticated using(status='RELEASED' and private.is_patient_for(clinic_id,patient_id));
create policy result_versions_staff_read on public.medical_result_versions for select to authenticated using(private.has_permission(clinic_id,'results.read'));
create policy patient_identities_self_read on public.patient_identities for select to authenticated using(user_id=auth.uid() and revoked_at is null);
create policy patient_identities_staff_read on public.patient_identities for select to authenticated using(private.has_permission(clinic_id,'patients.manage'));

grant select on public.clinic_notification_settings,public.communication_templates,public.appointment_confirmations,public.notification_jobs,public.communication_logs,public.document_types,public.patient_documents,public.medical_results,public.medical_result_versions,public.patient_identities to authenticated;
grant update(phone) on public.clinics to authenticated;
grant usage on type public.notification_channel,public.notification_status,public.notification_event,public.medical_result_status to authenticated,anon;

create function private.mask_recipient(value text,channel public.notification_channel) returns text language sql immutable set search_path='' as $$
 select case when channel='EMAIL' then left(value,1)||'***@'||coalesce(split_part(value,'@',2),'') else '***'||right(regexp_replace(value,'[^0-9]','','g'),4) end
$$;
create function private.queue_notification(cid uuid,event_value public.notification_event,aid uuid,pid uuid,confirmation uuid,send_at timestamptz,idempotency text) returns integer
language plpgsql security definer set search_path='' as $$
declare settings public.clinic_notification_settings; patient public.patients; oid uuid; inserted_count integer=0; inserted_id uuid; begin
 select organization_id into oid from public.clinics where id=cid;
 select * into settings from public.clinic_notification_settings where clinic_id=cid;
 select * into patient from public.patients where id=pid and clinic_id=cid;
 if oid is null or patient.id is null then return 0; end if;
 if coalesce(settings.sms_enabled,false) and length(regexp_replace(patient.phone,'[^0-9]','','g'))>=7 and exists(select 1 from public.communication_templates where clinic_id=cid and event=event_value and channel='SMS' and active) then
  insert into public.notification_jobs(organization_id,clinic_id,event,channel,appointment_id,patient_id,confirmation_id,recipient,scheduled_for,idempotency_key,created_by)
  values(oid,cid,event_value,'SMS',aid,pid,confirmation,patient.phone,send_at,idempotency||':sms',auth.uid()) on conflict(idempotency_key) do nothing returning id into inserted_id;
  if inserted_id is not null then
   inserted_count=inserted_count+1;
   insert into public.communication_logs(organization_id,clinic_id,job_id,event,channel,status,appointment_id,patient_id,recipient_masked)
   values(oid,cid,inserted_id,event_value,'SMS','QUEUED',aid,pid,private.mask_recipient(patient.phone,'SMS'));
  end if;
 end if;
 inserted_id=null;
 if coalesce(settings.email_enabled,true) and patient.email<>'' and exists(select 1 from public.communication_templates where clinic_id=cid and event=event_value and channel='EMAIL' and active) then
  insert into public.notification_jobs(organization_id,clinic_id,event,channel,appointment_id,patient_id,confirmation_id,recipient,scheduled_for,idempotency_key,created_by)
  values(oid,cid,event_value,'EMAIL',aid,pid,confirmation,patient.email,send_at,idempotency||':email',auth.uid()) on conflict(idempotency_key) do nothing returning id into inserted_id;
  if inserted_id is not null then
   inserted_count=inserted_count+1;
   insert into public.communication_logs(organization_id,clinic_id,job_id,event,channel,status,appointment_id,patient_id,recipient_masked)
   values(oid,cid,inserted_id,event_value,'EMAIL','QUEUED',aid,pid,private.mask_recipient(patient.email,'EMAIL'));
  end if;
 end if;
 if inserted_count>0 then insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata)
  values(oid,cid,auth.uid(),'notification_queued','appointments',aid,jsonb_build_object('event',event_value,'jobs',inserted_count)); end if;
 return inserted_count;
end $$;

create function private.initialize_clinic_communications() returns trigger language plpgsql security definer set search_path='' as $$ begin
 insert into public.clinic_notification_settings(clinic_id,organization_id) values(new.id,new.organization_id) on conflict do nothing;
 insert into public.document_types(organization_id,clinic_id,name,code) values
  (new.organization_id,new.id,'Rezultat','result'),(new.organization_id,new.id,'Analiză','analysis'),(new.organization_id,new.id,'Trimitere','referral'),
  (new.organization_id,new.id,'Consimțământ','consent'),(new.organization_id,new.id,'Document extern','external'),(new.organization_id,new.id,'Rețetă','prescription'),(new.organization_id,new.id,'Altele','other') on conflict do nothing;
 insert into public.communication_templates(organization_id,clinic_id,event,channel,subject,body)
 select new.organization_id,new.id,e.event::public.notification_event,c.channel::public.notification_channel,
  case when c.channel='EMAIL' then e.subject else '' end,e.body
 from (values
  ('APPOINTMENT_CREATED','Programare înregistrată','Programarea pentru {{service_name}} la {{clinic_name}} a fost înregistrată pentru {{date}}, ora {{time}}.'),
  ('CONFIRMATION_REQUESTED','Confirmați programarea','Confirmați programarea la {{clinic_name}}: {{confirmation_url}}'),
  ('APPOINTMENT_CONFIRMED','Programare confirmată','Programarea din {{date}}, ora {{time}}, a fost confirmată.'),
  ('APPOINTMENT_CHANGED','Programare modificată','Programarea a fost modificată. Data actuală: {{date}}, ora {{time}}. {{confirmation_url}}'),
  ('APPOINTMENT_CANCELLED','Programare anulată','Programarea din {{date}}, ora {{time}}, a fost anulată.'),
  ('APPOINTMENT_REMINDER','Reamintire programare','Vă reamintim programarea la {{clinic_name}} din {{date}}, ora {{time}}. {{confirmation_url}}'),
  ('RESULT_AVAILABLE','Rezultat disponibil','Un rezultat medical este disponibil în portalul pacientului: {{portal_url}}')
 ) e(event,subject,body) cross join (values('SMS'),('EMAIL')) c(channel) on conflict do nothing;
 return new; end $$;
create trigger initialize_clinic_communications after insert on public.clinics for each row execute function private.initialize_clinic_communications();
insert into public.clinic_notification_settings(clinic_id,organization_id) select id,organization_id from public.clinics on conflict do nothing;
insert into public.document_types(organization_id,clinic_id,name,code)
select c.organization_id,c.id,x.name,x.code from public.clinics c cross join (values('Rezultat','result'),('Analiză','analysis'),('Trimitere','referral'),('Consimțământ','consent'),('Document extern','external'),('Rețetă','prescription'),('Altele','other')) x(name,code) on conflict do nothing;
insert into public.communication_templates(organization_id,clinic_id,event,channel,subject,body)
select c.organization_id,c.id,e.event::public.notification_event,ch.channel::public.notification_channel,case when ch.channel='EMAIL' then e.subject else '' end,e.body
from public.clinics c cross join (values
 ('APPOINTMENT_CREATED','Programare înregistrată','Programarea pentru {{service_name}} la {{clinic_name}} a fost înregistrată pentru {{date}}, ora {{time}}.'),
 ('CONFIRMATION_REQUESTED','Confirmați programarea','Confirmați programarea la {{clinic_name}}: {{confirmation_url}}'),
 ('APPOINTMENT_CONFIRMED','Programare confirmată','Programarea din {{date}}, ora {{time}}, a fost confirmată.'),
 ('APPOINTMENT_CHANGED','Programare modificată','Programarea a fost modificată. Data actuală: {{date}}, ora {{time}}. {{confirmation_url}}'),
 ('APPOINTMENT_CANCELLED','Programare anulată','Programarea din {{date}}, ora {{time}}, a fost anulată.'),
 ('APPOINTMENT_REMINDER','Reamintire programare','Vă reamintim programarea la {{clinic_name}} din {{date}}, ora {{time}}. {{confirmation_url}}'),
 ('RESULT_AVAILABLE','Rezultat disponibil','Un rezultat medical este disponibil în portalul pacientului: {{portal_url}}')
) e(event,subject,body) cross join (values('SMS'),('EMAIL')) ch(channel) on conflict do nothing;

create function public.issue_appointment_confirmation(cid uuid,aid uuid,token_digest text,token_public_id uuid,expires timestamptz) returns uuid
language plpgsql security definer set search_path='' as $$
declare confirmation uuid; patient uuid; oid uuid; begin
 if not private.has_permission(cid,'appointments.manage') then raise exception 'Access denied' using errcode='42501'; end if;
 if token_digest !~ '^[a-f0-9]{64}$' or expires<=now()+interval '5 minutes' or expires>now()+interval '30 days' then raise exception 'Invalid token'; end if;
 select organization_id,patient_id into oid,patient from public.appointments where id=aid and clinic_id=cid and status not in ('CANCELLED','COMPLETED','NO_SHOW');
 if patient is null then raise exception 'Appointment unavailable'; end if;
 update public.appointment_confirmations set revoked_at=now() where appointment_id=aid and revoked_at is null;
 insert into public.appointment_confirmations(organization_id,clinic_id,appointment_id,public_id,token_hash,expires_at,created_by)
 values(oid,cid,aid,token_public_id,token_digest,expires,auth.uid()) returning id into confirmation;
 perform private.queue_notification(cid,'CONFIRMATION_REQUESTED',aid,patient,confirmation,now(),'confirmation:'||confirmation);
 return confirmation;
end $$;

create function public.public_confirmation_details(token_digest text,request_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; cid uuid; begin
 if token_digest !~ '^[a-f0-9]{64}$' or request_key !~ '^[a-f0-9]{64}$' then return null; end if;
 select x.clinic_id,to_jsonb(x)-'clinic_id' into cid,result from (
  select c.clinic_id,cl.name clinic_name,cl.address,cl.phone,cl.timezone,s.name service_name,s.instructions,s.required_documents,s.exclusion_rules,
   d.name doctor_name,a.start_at,a.end_at,a.status,c.expires_at
  from public.appointment_confirmations c join public.appointments a on a.id=c.appointment_id and a.clinic_id=c.clinic_id
  join public.clinics cl on cl.id=c.clinic_id join public.services s on s.id=a.service_id and s.clinic_id=a.clinic_id
  left join public.clinic_doctors d on d.id=a.doctor_location_id and d.clinic_id=a.clinic_id
  where c.token_hash=token_digest and c.revoked_at is null and c.expires_at>now()
 ) x;
 if cid is null then return null; end if;
 perform private.consume_public_rate('confirmation:clinic:'||cid,60,300);
 perform private.consume_public_rate('confirmation:key:'||cid||':'||request_key,60,30);
 return result;
end $$;

create function public.public_confirmation_action(token_digest text,action_value text,request_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare confirmation public.appointment_confirmations; current public.appointments; settings public.clinic_notification_settings; changed public.appointments; begin
 if token_digest !~ '^[a-f0-9]{64}$' or request_key !~ '^[a-f0-9]{64}$' or action_value not in ('confirm','cancel') then raise exception 'Invalid request'; end if;
 select * into confirmation from public.appointment_confirmations where token_hash=token_digest and revoked_at is null and expires_at>now() for update;
 if confirmation.id is null then raise exception 'Invalid token'; end if;
 perform private.consume_public_rate('confirmation:action:'||confirmation.clinic_id||':'||request_key,600,10);
 perform pg_advisory_xact_lock(hashtextextended(confirmation.clinic_id::text,21));
 select * into current from public.appointments where id=confirmation.appointment_id and clinic_id=confirmation.clinic_id for update;
 if action_value='confirm' then
  if current.status='PENDING' then update public.appointments set status='CONFIRMED' where id=current.id returning * into changed;
  elsif current.status='CONFIRMED' then update public.appointment_confirmations set used_at=coalesce(used_at,now()) where id=confirmation.id; return jsonb_build_object('ok',true,'status',current.status);
  else raise exception 'Action unavailable'; end if;
  update public.appointment_confirmations set used_at=coalesce(used_at,now()) where id=confirmation.id;
  insert into public.appointment_history(organization_id,clinic_id,appointment_id,event,actor_id,old_values,new_values,reason)
  values(current.organization_id,current.clinic_id,current.id,'STATUS_CHANGED',null,private.appointment_snapshot(current),private.appointment_snapshot(changed),'Confirmare pacient prin link securizat');
  insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata)
  values(current.organization_id,current.clinic_id,null,'appointment_confirmed_public','appointments',current.id,'{"channel":"confirmation_token"}');
 else
  select * into settings from public.clinic_notification_settings where clinic_id=current.clinic_id;
  if current.status not in ('PENDING','CONFIRMED') or now()>current.start_at-make_interval(hours=>coalesce(settings.cancellation_min_notice_hours,2)) then raise exception 'Cancellation unavailable'; end if;
  update public.appointments set status='CANCELLED',cancelled_at=now(),cancellation_reason='Anulare solicitată de pacient' where id=current.id returning * into changed;
  update public.appointment_confirmations set used_at=coalesce(used_at,now()),revoked_at=now() where id=confirmation.id;
  insert into public.appointment_history(organization_id,clinic_id,appointment_id,event,actor_id,old_values,new_values,reason)
  values(current.organization_id,current.clinic_id,current.id,'CANCELLED',null,private.appointment_snapshot(current),private.appointment_snapshot(changed),'Anulare pacient prin link securizat');
  insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata)
  values(current.organization_id,current.clinic_id,null,'appointment_cancelled_public','appointments',current.id,'{"channel":"confirmation_token"}');
 end if;
 return jsonb_build_object('ok',true,'status',changed.status);
end $$;

create function public.save_notification_settings(cid uuid,payload jsonb) returns void language plpgsql security definer set search_path='' as $$ begin
 if not private.has_permission(cid,'notifications.manage') then raise exception 'Access denied' using errcode='42501'; end if;
 update public.clinic_notification_settings set sms_enabled=(payload->>'sms_enabled')::boolean,email_enabled=(payload->>'email_enabled')::boolean,
  reminder_offsets_minutes=(select coalesce(array_agg(x::integer order by x::integer desc),'{}') from jsonb_array_elements_text(payload->'reminder_offsets_minutes') x),
  confirmation_expiry_hours=(payload->>'confirmation_expiry_hours')::integer,cancellation_min_notice_hours=(payload->>'cancellation_min_notice_hours')::integer
 where clinic_id=cid;
end $$;
create function public.save_communication_template(cid uuid,template_id uuid,template_subject text,template_body text,is_active boolean) returns void
language plpgsql security definer set search_path='' as $$ begin
 if not private.has_permission(cid,'notifications.manage') then raise exception 'Access denied' using errcode='42501'; end if;
 update public.communication_templates set subject=left(coalesce(template_subject,''),200),body=left(coalesce(template_body,''),4000),active=is_active
 where id=template_id and clinic_id=cid;
 if not found then raise exception 'Template unavailable'; end if;
end $$;

create function public.enqueue_due_reminders(reference_time timestamptz default now()) returns integer language plpgsql security definer set search_path='' as $$
declare item record; total integer=0; confirmation uuid; begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' then raise exception 'Worker access denied' using errcode='42501'; end if;
 for item in
  select a.id,a.clinic_id,a.patient_id,a.start_at,offset_value
  from public.appointments a join public.clinic_notification_settings n on n.clinic_id=a.clinic_id join public.services s on s.id=a.service_id
  cross join lateral unnest(coalesce(s.reminder_offsets_minutes,n.reminder_offsets_minutes)) offset_value
  where a.status in ('PENDING','CONFIRMED') and a.start_at-make_interval(mins=>offset_value) between reference_time-interval '5 minutes' and reference_time+interval '5 minutes'
 loop
  select id into confirmation from public.appointment_confirmations where appointment_id=item.id and revoked_at is null and expires_at>reference_time order by created_at desc limit 1;
  total=total+private.queue_notification(item.clinic_id,'APPOINTMENT_REMINDER',item.id,item.patient_id,confirmation,reference_time,'reminder:'||item.id||':'||item.offset_value);
 end loop;
 return total;
end $$;

create function public.claim_notification_jobs(batch_size integer default 20) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' then raise exception 'Worker access denied' using errcode='42501'; end if;
 if batch_size not between 1 and 100 then raise exception 'Invalid batch'; end if;
 with candidates as (select id from public.notification_jobs where (status in ('QUEUED','FAILED') or (status='SENDING' and locked_at<now()-interval '15 minutes')) and scheduled_for<=now() and attempts<max_attempts order by scheduled_for,id for update skip locked limit batch_size),
 updated as (update public.notification_jobs j set status='SENDING',attempts=attempts+1,locked_at=now(),updated_at=now() from candidates c where j.id=c.id returning j.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'clinic_id',u.clinic_id,'event',u.event,'channel',u.channel,'recipient',u.recipient,'appointment_id',u.appointment_id,'patient_id',u.patient_id,'confirmation_id',u.confirmation_id,'idempotency_key',u.idempotency_key)),'[]') into result from updated u;
 return result;
end $$;
create function public.notification_job_context(job_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' then raise exception 'Worker access denied' using errcode='42501'; end if;
 select jsonb_build_object('clinic_name',c.name,'clinic_address',c.address,'clinic_phone',c.phone,'timezone',c.timezone,'patient_name',p.name,
  'service_name',s.name,'start_at',a.start_at,'template_subject',t.subject,'template_body',t.body,'confirmation_public_id',ac.public_id,'confirmation_expires_at',ac.expires_at)
 into result from public.notification_jobs j join public.clinics c on c.id=j.clinic_id join public.patients p on p.id=j.patient_id and p.clinic_id=j.clinic_id
 left join public.appointments a on a.id=j.appointment_id and a.clinic_id=j.clinic_id left join public.services s on s.id=a.service_id and s.clinic_id=a.clinic_id
 left join public.appointment_confirmations ac on ac.id=j.confirmation_id
 left join public.communication_templates t on t.clinic_id=j.clinic_id and t.event=j.event and t.channel=j.channel and t.active
 where j.id=job_id;
 return result;
end $$;
create function public.finish_notification_job(job_id uuid,final_status public.notification_status,provider_id text,error_text text default '') returns void
language plpgsql security definer set search_path='' as $$
declare job public.notification_jobs; begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' or final_status not in ('SENT','DELIVERED','FAILED') then raise exception 'Worker access denied' using errcode='42501'; end if;
 select * into job from public.notification_jobs where id=job_id and status='SENDING' for update;
 if job.id is null then return; end if;
 update public.notification_jobs set status=final_status,provider_message_id=left(provider_id,250),last_error=left(error_text,500),sent_at=case when final_status in ('SENT','DELIVERED') then now() else sent_at end,updated_at=now() where id=job_id;
 update public.communication_logs set status=final_status,attempts=job.attempts,provider_message_id=left(provider_id,250),last_error=left(error_text,500),sent_at=case when final_status in ('SENT','DELIVERED') then now() else sent_at end,updated_at=now() where job_id=job.id;
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata)
 values(job.organization_id,job.clinic_id,null,case when final_status='FAILED' then 'notification_failed' else 'notification_sent' end,'notification_jobs',job.id,jsonb_build_object('event',job.event,'channel',job.channel,'attempt',job.attempts));
end $$;

create function public.link_patient_identity(cid uuid,pid uuid,uid uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare oid uuid; identity uuid; begin
 if not private.has_permission(cid,'patients.manage') then raise exception 'Access denied' using errcode='42501'; end if;
 select organization_id into oid from public.patients where id=pid and clinic_id=cid;
 if oid is null or not exists(select 1 from public.profiles where id=uid) then raise exception 'Patient or account unavailable'; end if;
 insert into public.patient_identities(user_id,organization_id,clinic_id,patient_id,created_by) values(uid,oid,cid,pid,auth.uid())
 on conflict(user_id,clinic_id) do update set patient_id=excluded.patient_id,revoked_at=null,verified_at=now(),created_by=auth.uid() returning id into identity;
 return identity;
end $$;

create function public.list_patient_documents(cid uuid,pid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not (private.has_permission(cid,'documents.read') or private.is_patient_for(cid,pid)) then raise exception 'Access denied' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'title',d.title,'type_name',t.name,'file_name',d.file_name,'mime_type',d.mime_type,'file_size',d.file_size,'visible_to_patient',d.visible_to_patient,'appointment_id',d.appointment_id,'created_at',d.created_at) order by d.created_at desc)
  from public.patient_documents d join public.document_types t on t.id=d.document_type_id and t.clinic_id=d.clinic_id
  where d.clinic_id=cid and d.patient_id=pid and d.archived_at is null and (private.has_permission(cid,'documents.read') or d.visible_to_patient)),'[]');
end $$;
create function public.save_patient_document(cid uuid,pid uuid,aid uuid,type_id uuid,document_title text,path text,file_label text,mime text,bytes bigint,patient_visible boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare oid uuid; document_id uuid; begin
 if not private.has_permission(cid,'documents.manage') then raise exception 'Access denied' using errcode='42501'; end if;
 select organization_id into oid from public.patients where id=pid and clinic_id=cid;
 if oid is null or path not like cid::text||'/'||pid::text||'/documents/%' or not exists(select 1 from public.document_types where id=type_id and clinic_id=cid and active) then raise exception 'Invalid document'; end if;
 if aid is not null and not exists(select 1 from public.appointments where id=aid and clinic_id=cid and patient_id=pid) then raise exception 'Invalid appointment'; end if;
 insert into public.patient_documents(organization_id,clinic_id,patient_id,appointment_id,document_type_id,title,object_path,file_name,mime_type,file_size,visible_to_patient,created_by,uploaded_by)
 values(oid,cid,pid,aid,type_id,trim(document_title),path,file_label,mime,bytes,patient_visible,auth.uid(),auth.uid()) returning id into document_id;
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata) values(oid,cid,auth.uid(),'document_uploaded','patient_documents',document_id,jsonb_build_object('patient_id',pid,'mime_type',mime,'size',bytes));
 return document_id;
end $$;
create function public.authorize_document_download(cid uuid,document_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; oid uuid; pid uuid; begin
 select d.organization_id,d.patient_id,jsonb_build_object('path',d.object_path,'file_name',d.file_name,'mime_type',d.mime_type) into oid,pid,result from public.patient_documents d
 where d.id=document_id and d.clinic_id=cid and d.archived_at is null and (private.has_permission(cid,'documents.read') or (d.visible_to_patient and private.is_patient_for(cid,d.patient_id)));
 if result is null then raise exception 'Access denied' using errcode='42501'; end if;
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata) values(oid,cid,auth.uid(),'document_downloaded','patient_documents',document_id,jsonb_build_object('patient_id',pid));
 return result;
end $$;

create function public.list_medical_results(cid uuid,pid uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not (private.has_permission(cid,'results.read') or (pid is not null and private.is_patient_for(cid,pid))) then raise exception 'Access denied' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
  select r.id,r.patient_id,p.name patient_name,r.appointment_id,r.service_id,s.name service_name,r.doctor_location_id,d.name doctor_name,r.title,r.status,r.version,r.pdf_object_path,r.validated_at,r.released_at,r.created_at,r.updated_at
  from public.medical_results r join public.patients p on p.id=r.patient_id and p.clinic_id=r.clinic_id join public.services s on s.id=r.service_id and s.clinic_id=r.clinic_id
  join public.clinic_doctors d on d.id=r.doctor_location_id and d.clinic_id=r.clinic_id
  where r.clinic_id=cid and (pid is null or r.patient_id=pid) and (private.has_permission(cid,'results.read') or r.status='RELEASED')
 ) x),'[]');
end $$;
create function public.read_medical_result(cid uuid,result_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; begin
 select to_jsonb(x) into result from (
  select r.*,p.name patient_name,p.internal_id patient_internal_id,p.birth_date,s.name service_name,d.name doctor_name,d.professional_code,c.name clinic_name,c.address clinic_address,c.phone clinic_phone,c.timezone
  from public.medical_results r join public.patients p on p.id=r.patient_id and p.clinic_id=r.clinic_id join public.services s on s.id=r.service_id and s.clinic_id=r.clinic_id
  join public.clinic_doctors d on d.id=r.doctor_location_id and d.clinic_id=r.clinic_id join public.clinics c on c.id=r.clinic_id
  where r.id=result_id and r.clinic_id=cid and (private.has_permission(cid,'results.read') or (r.status='RELEASED' and private.is_patient_for(cid,r.patient_id)))
 ) x;
 if result is null then raise exception 'Access denied' using errcode='42501'; end if; return result;
end $$;
create function public.save_medical_result(cid uuid,result_id uuid,aid uuid,did uuid,result_title text,result_content text,expected_version integer default null,change_reason text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare appointment public.appointments; current public.medical_results; rid uuid; begin
 if not private.can_manage_result(cid,did,'results.manage') then raise exception 'Access denied' using errcode='42501'; end if;
 select * into appointment from public.appointments where id=aid and clinic_id=cid and doctor_location_id=did;
 if appointment.id is null then raise exception 'Appointment unavailable'; end if;
 if result_id is null then
  insert into public.medical_results(organization_id,clinic_id,patient_id,appointment_id,service_id,doctor_location_id,title,content,created_by)
  values(appointment.organization_id,cid,appointment.patient_id,aid,appointment.service_id,did,trim(result_title),result_content,auth.uid()) returning id into rid;
  insert into public.medical_result_versions(organization_id,clinic_id,result_id,version,status,title,content,changed_by,change_reason)
  values(appointment.organization_id,cid,rid,1,'DRAFT',trim(result_title),result_content,auth.uid(),'Creare rezultat');
  insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata) values(appointment.organization_id,cid,auth.uid(),'result_created','medical_results',rid,jsonb_build_object('appointment_id',aid,'version',1));
 else
  select * into current from public.medical_results where id=result_id and clinic_id=cid for update;
  if current.id is null or current.status<>'DRAFT' or current.version<>expected_version or current.doctor_location_id<>did then raise exception 'Result unavailable or stale'; end if;
  update public.medical_results set title=trim(result_title),content=result_content,version=version+1 where id=result_id returning version into expected_version;
  insert into public.medical_result_versions(organization_id,clinic_id,result_id,version,status,title,content,changed_by,change_reason)
  values(current.organization_id,cid,result_id,expected_version,'DRAFT',trim(result_title),result_content,auth.uid(),left(coalesce(change_reason,''),1000));
  insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata) values(current.organization_id,cid,auth.uid(),'result_edited','medical_results',result_id,jsonb_build_object('version',expected_version)); rid=result_id;
 end if; return rid;
end $$;
create function public.transition_medical_result(cid uuid,result_id uuid,next_status public.medical_result_status,pdf_path text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare current public.medical_results; changed public.medical_results; begin
 select * into current from public.medical_results where id=result_id and clinic_id=cid for update;
 if current.id is null or not private.can_manage_result(cid,current.doctor_location_id,'results.release') then raise exception 'Access denied' using errcode='42501'; end if;
 if next_status='VALIDATED' and current.status='DRAFT' then
  update public.medical_results set status='VALIDATED',validated_at=now(),validated_by=auth.uid(),version=version+1 where id=result_id returning * into changed;
 elsif next_status='RELEASED' and current.status='VALIDATED' and pdf_path like cid::text||'/'||current.patient_id::text||'/results/'||result_id::text||'/%' then
  update public.medical_results set status='RELEASED',released_at=now(),released_by=auth.uid(),pdf_object_path=pdf_path,version=version+1 where id=result_id returning * into changed;
 else raise exception 'Invalid result transition'; end if;
 insert into public.medical_result_versions(organization_id,clinic_id,result_id,version,status,title,content,changed_by,change_reason)
 values(changed.organization_id,cid,result_id,changed.version,changed.status,changed.title,changed.content,auth.uid(),case when next_status='VALIDATED' then 'Validare' else 'Publicare în portal' end);
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata) values(changed.organization_id,cid,auth.uid(),case when next_status='VALIDATED' then 'result_validated' else 'result_released' end,'medical_results',result_id,jsonb_build_object('version',changed.version));
 if next_status='RELEASED' then perform private.queue_notification(cid,'RESULT_AVAILABLE',changed.appointment_id,changed.patient_id,null,now(),'result:'||result_id||':'||changed.version); end if;
 return jsonb_build_object('ok',true,'status',changed.status,'version',changed.version);
end $$;
create function public.authorize_result_download(cid uuid,result_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; item public.medical_results; begin
 select * into item from public.medical_results where id=result_id and clinic_id=cid and pdf_object_path is not null and (private.has_permission(cid,'results.read') or (status='RELEASED' and private.is_patient_for(cid,patient_id)));
 if item.id is null then raise exception 'Access denied' using errcode='42501'; end if;
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata) values(item.organization_id,cid,auth.uid(),'result_downloaded','medical_results',result_id,jsonb_build_object('patient_id',item.patient_id,'version',item.version));
 return jsonb_build_object('path',item.pdf_object_path,'file_name','rezultat-'||result_id||'.pdf','mime_type','application/pdf');
end $$;

create function public.set_doctor_credentials(cid uuid,did uuid,staff_uid uuid,signature_path text,signature_type text,stamp_path text,stamp_type text) returns void
language plpgsql security definer set search_path='' as $$
declare oid uuid; allowed boolean; begin
 select organization_id into oid from public.doctor_locations where id=did and clinic_id=cid;
 allowed=private.has_permission(cid,'credentials.manage') and (exists(select 1 from public.clinic_memberships where clinic_id=cid and user_id=auth.uid() and active and role in ('OWNER','ADMIN')) or auth.uid()=coalesce(staff_uid,(select staff_user_id from public.doctor_locations where id=did)));
 if oid is null or not allowed then raise exception 'Access denied' using errcode='42501'; end if;
 if staff_uid is not null and not exists(select 1 from public.clinic_memberships where clinic_id=cid and user_id=staff_uid and active and role='DOCTOR') then raise exception 'Invalid doctor account'; end if;
 update public.doctor_locations set staff_user_id=coalesce(staff_uid,staff_user_id) where id=did and clinic_id=cid;
 insert into public.doctor_credentials(doctor_location_id,clinic_id,organization_id,signature_object_path,stamp_object_path,signature_mime,stamp_mime,updated_by)
 values(did,cid,oid,signature_path,stamp_path,signature_type,stamp_type,auth.uid()) on conflict(doctor_location_id) do update set
  signature_object_path=coalesce(excluded.signature_object_path,public.doctor_credentials.signature_object_path),stamp_object_path=coalesce(excluded.stamp_object_path,public.doctor_credentials.stamp_object_path),
  signature_mime=coalesce(excluded.signature_mime,public.doctor_credentials.signature_mime),stamp_mime=coalesce(excluded.stamp_mime,public.doctor_credentials.stamp_mime),updated_by=auth.uid(),updated_at=now();
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata) values(oid,cid,auth.uid(),'doctor_credentials_updated','doctor_locations',did,jsonb_build_object('signature_changed',signature_path is not null,'stamp_changed',stamp_path is not null,'staff_link_changed',staff_uid is not null));
end $$;
create function public.read_doctor_credentials(cid uuid,did uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.has_permission(cid,'catalog.read') then raise exception 'Access denied' using errcode='42501'; end if;
 return coalesce((select jsonb_build_object('staff_user_id',d.staff_user_id,'signature_object_path',c.signature_object_path,'signature_mime',c.signature_mime,'stamp_object_path',c.stamp_object_path,'stamp_mime',c.stamp_mime)
  from public.doctor_locations d left join public.doctor_credentials c on c.doctor_location_id=d.id where d.id=did and d.clinic_id=cid),'{}');
end $$;

create function public.patient_portal_home() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; begin
 select jsonb_build_object('generated_at',now(),'patient',jsonb_build_object('id',p.id,'clinic_id',p.clinic_id,'name',p.name,'internal_id',p.internal_id,'birth_date',p.birth_date,'phone',p.phone,'email',p.email,'address',p.address,'city',p.city,'clinic_name',c.name,'clinic_address',c.address,'timezone',c.timezone),
  'appointments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'start_at',a.start_at,'end_at',a.end_at,'status',a.status,'service_name',s.name,'doctor_name',d.name,'instructions',s.instructions,'required_documents',s.required_documents,'exclusion_rules',s.exclusion_rules) order by a.start_at desc) from public.appointments a join public.services s on s.id=a.service_id left join public.clinic_doctors d on d.id=a.doctor_location_id where a.clinic_id=p.clinic_id and a.patient_id=p.id),'[]'),
  'results',public.list_medical_results(p.clinic_id,p.id),'documents',public.list_patient_documents(p.clinic_id,p.id)) into result
 from public.patient_identities i join public.patients p on p.id=i.patient_id and p.clinic_id=i.clinic_id join public.clinics c on c.id=i.clinic_id
 where i.user_id=auth.uid() and i.revoked_at is null order by i.created_at limit 1;
 return result;
end $$;
create function public.patient_portal_appointment_action(aid uuid,action_value text) returns jsonb language plpgsql security definer set search_path='' as $$
declare current public.appointments; settings public.clinic_notification_settings; changed public.appointments; begin
 select a.* into current from public.appointments a where a.id=aid and private.is_patient_for(a.clinic_id,a.patient_id) for update;
 if current.id is null or action_value not in ('confirm','cancel') then raise exception 'Access denied' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(current.clinic_id::text,21));
 if action_value='confirm' and current.status='PENDING' then update public.appointments set status='CONFIRMED' where id=aid returning * into changed;
 elsif action_value='confirm' and current.status='CONFIRMED' then return jsonb_build_object('ok',true,'status',current.status);
 elsif action_value='cancel' then
  select * into settings from public.clinic_notification_settings where clinic_id=current.clinic_id;
  if current.status not in ('PENDING','CONFIRMED') or now()>current.start_at-make_interval(hours=>coalesce(settings.cancellation_min_notice_hours,2)) then raise exception 'Cancellation unavailable'; end if;
  update public.appointments set status='CANCELLED',cancelled_at=now(),cancellation_reason='Anulare din portalul pacientului' where id=aid returning * into changed;
 else raise exception 'Action unavailable'; end if;
 insert into public.appointment_history(organization_id,clinic_id,appointment_id,event,actor_id,old_values,new_values,reason) values(current.organization_id,current.clinic_id,current.id,case when action_value='confirm' then 'STATUS_CHANGED' else 'CANCELLED' end,null,private.appointment_snapshot(current),private.appointment_snapshot(changed),'Acțiune din portalul pacientului');
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata) values(current.organization_id,current.clinic_id,auth.uid(),'appointment_'||action_value||'_portal','appointments',aid,'{}');
 return jsonb_build_object('ok',true,'status',changed.status);
end $$;

create function private.appointment_communication_event() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.appointments; event_value public.notification_event; confirmation uuid; begin
 if new.event='CREATED' then event_value='APPOINTMENT_CREATED';
 elsif new.event='RESCHEDULED' then event_value='APPOINTMENT_CHANGED';
 elsif new.event='CANCELLED' then event_value='APPOINTMENT_CANCELLED';
 elsif new.event='STATUS_CHANGED' and new.new_values->>'status'='CONFIRMED' then event_value='APPOINTMENT_CONFIRMED'; else return new; end if;
 select * into a from public.appointments where id=new.appointment_id;
 select id into confirmation from public.appointment_confirmations where appointment_id=a.id and revoked_at is null and expires_at>now() order by created_at desc limit 1;
 perform private.queue_notification(a.clinic_id,event_value,a.id,a.patient_id,confirmation,now(),lower(event_value::text)||':'||new.id);
 return new;
end $$;
create trigger appointment_communication_event after insert on public.appointment_history for each row execute function private.appointment_communication_event();

create function public.can_access_medical_object(object_name text,access_mode text) returns boolean language sql stable security definer set search_path='' as $$ select false $$;

-- Private Storage is provisioned automatically on hosted/local Supabase and is
-- skipped by the PostgreSQL-only test runtime where the storage schema is absent.
do $$ begin
 if exists(select 1 from pg_namespace where nspname='storage') then
  execute $sql$insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('voxa-medical','voxa-medical',false,20971520,array['application/pdf','image/png','image/jpeg','image/webp']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types$sql$;
  execute $sql$create policy voxa_medical_read on storage.objects for select to authenticated using(bucket_id='voxa-medical' and public.can_access_medical_object(name,'read'))$sql$;
  execute $sql$create policy voxa_medical_insert on storage.objects for insert to authenticated with check(bucket_id='voxa-medical' and public.can_access_medical_object(name,'write'))$sql$;
  execute $sql$create policy voxa_medical_update on storage.objects for update to authenticated using(bucket_id='voxa-medical' and public.can_access_medical_object(name,'write')) with check(bucket_id='voxa-medical' and public.can_access_medical_object(name,'write'))$sql$;
 end if;
end $$;

create or replace function public.can_access_medical_object(object_name text,access_mode text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare cid uuid; pid uuid; area text; object_id uuid; begin
 begin cid=split_part(object_name,'/',1)::uuid; exception when others then return false; end;
 area=split_part(object_name,'/',3);
 if area='doctors' then
  begin object_id=split_part(object_name,'/',4)::uuid; exception when others then return false; end;
  return private.has_permission(cid,'credentials.manage') and (exists(select 1 from public.clinic_memberships where clinic_id=cid and user_id=auth.uid() and role in ('OWNER','ADMIN') and active) or exists(select 1 from public.doctor_locations where id=object_id and clinic_id=cid and staff_user_id=auth.uid()));
 end if;
 begin pid=split_part(object_name,'/',2)::uuid; exception when others then return false; end;
 if access_mode='write' then return (area='documents' and private.has_permission(cid,'documents.manage')) or (area='results' and private.has_permission(cid,'results.release')); end if;
 if area='documents' then return private.has_permission(cid,'documents.read') or exists(select 1 from public.patient_documents d where d.object_path=object_name and d.visible_to_patient and d.archived_at is null and private.is_patient_for(cid,d.patient_id)); end if;
 if area='results' then return private.has_permission(cid,'results.read') or exists(select 1 from public.medical_results r where r.pdf_object_path=object_name and r.status='RELEASED' and private.is_patient_for(cid,r.patient_id)); end if;
 return false;
end $$;

revoke all on function private.is_patient_for(uuid,uuid),private.can_manage_result(uuid,uuid,text),private.mask_recipient(text,public.notification_channel),private.queue_notification(uuid,public.notification_event,uuid,uuid,uuid,timestamptz,text),private.initialize_clinic_communications(),private.appointment_communication_event() from public,anon,authenticated;
revoke all on function public.issue_appointment_confirmation(uuid,uuid,text,uuid,timestamptz),public.save_notification_settings(uuid,jsonb),public.save_communication_template(uuid,uuid,text,text,boolean),public.link_patient_identity(uuid,uuid,uuid),public.list_patient_documents(uuid,uuid),public.save_patient_document(uuid,uuid,uuid,uuid,text,text,text,text,bigint,boolean),public.authorize_document_download(uuid,uuid),public.list_medical_results(uuid,uuid),public.read_medical_result(uuid,uuid),public.save_medical_result(uuid,uuid,uuid,uuid,text,text,integer,text),public.transition_medical_result(uuid,uuid,public.medical_result_status,text),public.authorize_result_download(uuid,uuid),public.set_doctor_credentials(uuid,uuid,uuid,text,text,text,text),public.read_doctor_credentials(uuid,uuid),public.patient_portal_home(),public.patient_portal_appointment_action(uuid,text),public.can_access_medical_object(text,text) from public,anon;
grant execute on function public.issue_appointment_confirmation(uuid,uuid,text,uuid,timestamptz),public.save_notification_settings(uuid,jsonb),public.save_communication_template(uuid,uuid,text,text,boolean),public.link_patient_identity(uuid,uuid,uuid),public.list_patient_documents(uuid,uuid),public.save_patient_document(uuid,uuid,uuid,uuid,text,text,text,text,bigint,boolean),public.authorize_document_download(uuid,uuid),public.list_medical_results(uuid,uuid),public.read_medical_result(uuid,uuid),public.save_medical_result(uuid,uuid,uuid,uuid,text,text,integer,text),public.transition_medical_result(uuid,uuid,public.medical_result_status,text),public.authorize_result_download(uuid,uuid),public.set_doctor_credentials(uuid,uuid,uuid,text,text,text,text),public.read_doctor_credentials(uuid,uuid),public.patient_portal_home(),public.patient_portal_appointment_action(uuid,text),public.can_access_medical_object(text,text) to authenticated;
revoke all on function public.public_confirmation_details(text,text),public.public_confirmation_action(text,text,text) from public,authenticated;
grant execute on function public.public_confirmation_details(text,text),public.public_confirmation_action(text,text,text) to anon;
revoke all on function public.enqueue_due_reminders(timestamptz),public.claim_notification_jobs(integer),public.notification_job_context(uuid),public.finish_notification_job(uuid,public.notification_status,text,text) from public,anon,authenticated;
do $$ begin if exists(select 1 from pg_roles where rolname='service_role') then
 execute 'grant execute on function public.enqueue_due_reminders(timestamptz),public.claim_notification_jobs(integer),public.notification_job_context(uuid),public.finish_notification_job(uuid,public.notification_status,text,text) to service_role'; end if; end $$;

-- The web application uses this narrowly scoped service-role entry point after
-- a successful public booking. The caller supplies only a digest; the raw token
-- never crosses the database boundary.
create function public.issue_system_confirmation(cid uuid,aid uuid,token_digest text,token_public_id uuid,expires timestamptz) returns uuid
language plpgsql security definer set search_path='' as $$
declare confirmation uuid; patient uuid; oid uuid; begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' then raise exception 'Worker access denied' using errcode='42501'; end if;
 if token_digest !~ '^[a-f0-9]{64}$' or expires<=now()+interval '5 minutes' or expires>now()+interval '30 days' then raise exception 'Invalid token'; end if;
 select organization_id,patient_id into oid,patient from public.appointments where id=aid and clinic_id=cid and status not in ('CANCELLED','COMPLETED','NO_SHOW');
 if patient is null then raise exception 'Appointment unavailable'; end if;
 update public.appointment_confirmations set revoked_at=now() where appointment_id=aid and revoked_at is null;
 insert into public.appointment_confirmations(organization_id,clinic_id,appointment_id,public_id,token_hash,expires_at)
 values(oid,cid,aid,token_public_id,token_digest,expires) returning id into confirmation;
 perform private.queue_notification(cid,'CONFIRMATION_REQUESTED',aid,patient,confirmation,now(),'confirmation:'||confirmation);
 return confirmation;
end $$;

create function public.result_appointment_options(cid uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.has_permission(cid,'results.manage') then raise exception 'Access denied' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'id',a.id,'patient_id',a.patient_id,'patient_name',p.name,'patient_internal_id',p.internal_id,
  'service_id',a.service_id,'service_name',s.name,'doctor_id',a.doctor_location_id,'doctor_name',d.name,
  'start_at',a.start_at,'status',a.status
 ) order by a.start_at desc)
 from public.appointments a join public.patients p on p.id=a.patient_id and p.clinic_id=a.clinic_id
 join public.services s on s.id=a.service_id and s.clinic_id=a.clinic_id
 join public.clinic_doctors d on d.id=a.doctor_location_id and d.clinic_id=a.clinic_id
 where a.clinic_id=cid and a.status not in ('CANCELLED','NO_SHOW')
 and not exists(select 1 from public.medical_results r where r.appointment_id=a.id)
 and (exists(select 1 from public.clinic_memberships m where m.clinic_id=cid and m.user_id=auth.uid() and m.active and m.role in ('OWNER','ADMIN'))
      or a.doctor_location_id in(select dl.id from public.doctor_locations dl where dl.clinic_id=cid and dl.staff_user_id=auth.uid() and dl.active and dl.archived_at is null))
 ),'[]');
end $$;

create function public.lookup_patient_auth_user(cid uuid,pid uuid) returns uuid
language plpgsql stable security definer set search_path='' as $$
declare result uuid; patient_email text; begin
 if not private.has_permission(cid,'patients.manage') then raise exception 'Access denied' using errcode='42501'; end if;
 select lower(nullif(trim(email),'')) into patient_email from public.patients where id=pid and clinic_id=cid;
 if patient_email is null then return null; end if;
 select id into result from auth.users where lower(email)=patient_email order by created_at limit 1;
 return result;
end $$;

do $$ declare t text; begin
 foreach t in array array['clinic_notification_settings','communication_templates','notification_jobs','communication_logs','document_types','patient_documents','medical_results','doctor_credentials'] loop
  execute format('create trigger %I_touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()',t,t);
 end loop;
end $$;

-- Credentials live at <clinic>/doctors/<doctor-location>/..., while patient
-- files live at <clinic>/<patient>/{documents,results}/....
create or replace function public.can_access_medical_object(object_name text,access_mode text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare cid uuid; pid uuid; area text; object_id uuid; begin
 begin cid=split_part(object_name,'/',1)::uuid; exception when others then return false; end;
 if split_part(object_name,'/',2)='doctors' then
  begin object_id=split_part(object_name,'/',3)::uuid; exception when others then return false; end;
  return private.has_permission(cid,'credentials.manage') and (exists(select 1 from public.clinic_memberships where clinic_id=cid and user_id=auth.uid() and role in ('OWNER','ADMIN') and active) or exists(select 1 from public.doctor_locations where id=object_id and clinic_id=cid and staff_user_id=auth.uid()));
 end if;
 begin pid=split_part(object_name,'/',2)::uuid; exception when others then return false; end;
 area=split_part(object_name,'/',3);
 if access_mode='write' then return (area='documents' and private.has_permission(cid,'documents.manage')) or (area='results' and private.has_permission(cid,'results.release')); end if;
 if area='documents' then return private.has_permission(cid,'documents.read') or exists(select 1 from public.patient_documents d where d.object_path=object_name and d.visible_to_patient and d.archived_at is null and private.is_patient_for(cid,d.patient_id)); end if;
 if area='results' then return private.has_permission(cid,'results.read') or exists(select 1 from public.medical_results r where r.pdf_object_path=object_name and r.status='RELEASED' and private.is_patient_for(cid,r.patient_id)); end if;
 return false;
end $$;

revoke all on function public.issue_system_confirmation(uuid,uuid,text,uuid,timestamptz),public.result_appointment_options(uuid),public.lookup_patient_auth_user(uuid,uuid) from public,anon,authenticated;
grant execute on function public.result_appointment_options(uuid),public.lookup_patient_auth_user(uuid,uuid) to authenticated;
do $$ begin if exists(select 1 from pg_roles where rolname='service_role') then
 execute 'grant execute on function public.issue_system_confirmation(uuid,uuid,text,uuid,timestamptz) to service_role';
end if; end $$;
