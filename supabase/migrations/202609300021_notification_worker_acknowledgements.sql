-- Fix ambiguous communication log column and support current PostgREST JWT claims.
create or replace function public.enqueue_due_reminders(reference_time timestamptz default now()) returns integer language plpgsql security definer set search_path='' as $$
declare item record; total integer=0; confirmation uuid; begin
 if coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role',nullif(current_setting('request.jwt.claim.role',true),''),'')<>'service_role' then raise exception 'Worker access denied' using errcode='42501'; end if;
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

create or replace function public.claim_notification_jobs(batch_size integer default 20) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; begin
 if coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role',nullif(current_setting('request.jwt.claim.role',true),''),'')<>'service_role' then raise exception 'Worker access denied' using errcode='42501'; end if;
 if batch_size not between 1 and 100 then raise exception 'Invalid batch'; end if;
 with candidates as (select id from public.notification_jobs where (status in ('QUEUED','FAILED') or (status='SENDING' and locked_at<now()-interval '15 minutes')) and scheduled_for<=now() and attempts<max_attempts order by scheduled_for,id for update skip locked limit batch_size),
 updated as (update public.notification_jobs j set status='SENDING',attempts=attempts+1,locked_at=now(),updated_at=now() from candidates c where j.id=c.id returning j.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'clinic_id',u.clinic_id,'event',u.event,'channel',u.channel,'recipient',u.recipient,'appointment_id',u.appointment_id,'patient_id',u.patient_id,'confirmation_id',u.confirmation_id,'idempotency_key',u.idempotency_key)),'[]') into result from updated u;
 return result;
end $$;
create or replace function public.notification_job_context(job_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; begin
 if coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role',nullif(current_setting('request.jwt.claim.role',true),''),'')<>'service_role' then raise exception 'Worker access denied' using errcode='42501'; end if;
 select jsonb_build_object('clinic_name',c.name,'clinic_address',c.address,'clinic_phone',c.phone,'timezone',c.timezone,'patient_name',p.name,
  'service_name',s.name,'start_at',a.start_at,'template_subject',t.subject,'template_body',t.body,'confirmation_public_id',ac.public_id,'confirmation_expires_at',ac.expires_at)
 into result from public.notification_jobs j join public.clinics c on c.id=j.clinic_id join public.patients p on p.id=j.patient_id and p.clinic_id=j.clinic_id
 left join public.appointments a on a.id=j.appointment_id and a.clinic_id=j.clinic_id left join public.services s on s.id=a.service_id and s.clinic_id=a.clinic_id
 left join public.appointment_confirmations ac on ac.id=j.confirmation_id
 left join public.communication_templates t on t.clinic_id=j.clinic_id and t.event=j.event and t.channel=j.channel and t.active
 where j.id=job_id;
 return result;
end $$;
create or replace function public.finish_notification_job(job_id uuid,final_status public.notification_status,provider_id text,error_text text default '') returns void
language plpgsql security definer set search_path='' as $$
declare job public.notification_jobs; begin
 if coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role',nullif(current_setting('request.jwt.claim.role',true),''),'')<>'service_role' or final_status not in ('SENT','DELIVERED','FAILED') then raise exception 'Worker access denied' using errcode='42501'; end if;
 select * into job from public.notification_jobs where id=job_id and status='SENDING' for update;
 if job.id is null then return; end if;
 update public.notification_jobs set status=final_status,provider_message_id=left(provider_id,250),last_error=left(error_text,500),sent_at=case when final_status in ('SENT','DELIVERED') then now() else sent_at end,updated_at=now() where id=job_id;
 update public.communication_logs set status=final_status,attempts=job.attempts,provider_message_id=left(provider_id,250),last_error=left(error_text,500),sent_at=case when final_status in ('SENT','DELIVERED') then now() else sent_at end,updated_at=now() where communication_logs.job_id=job.id;
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata)
 values(job.organization_id,job.clinic_id,null,case when final_status='FAILED' then 'notification_failed' else 'notification_sent' end,'notification_jobs',job.id,jsonb_build_object('event',job.event,'channel',job.channel,'attempt',job.attempts));
end $$;


