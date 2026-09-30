create table public.manual_patient_communications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  clinic_id uuid not null references public.clinics(id),
  patient_id uuid not null references public.patients(id),
  actor_id uuid references auth.users(id),
  channel text not null check (channel in ('PHONE','WHATSAPP','EMAIL','SMS','IN_PERSON','OTHER')),
  direction text not null check (direction in ('OUTBOUND','INBOUND')),
  summary text not null check (char_length(trim(summary)) between 2 and 1000),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index manual_patient_communications_patient_time on public.manual_patient_communications(clinic_id,patient_id,occurred_at desc);
alter table public.manual_patient_communications enable row level security;
create policy manual_patient_communications_read on public.manual_patient_communications for select to authenticated
  using (private.has_permission(clinic_id,'notifications.read'));
grant select on public.manual_patient_communications to authenticated;

create function public.record_patient_communication(cid uuid,pid uuid,channel_value text,direction_value text,summary_value text,occurred timestamptz default now()) returns uuid
language plpgsql security definer set search_path='' as $$
declare oid uuid; created_id uuid;
begin
  if not private.has_permission(cid,'patients.manage') then raise exception 'Access denied' using errcode='42501'; end if;
  if channel_value not in ('PHONE','WHATSAPP','EMAIL','SMS','IN_PERSON','OTHER') or direction_value not in ('OUTBOUND','INBOUND') or char_length(trim(coalesce(summary_value,''))) not between 2 and 1000 then raise exception 'Invalid communication'; end if;
  select organization_id into oid from public.patients where id=pid and clinic_id=cid and archived_at is null;
  if oid is null then raise exception 'Patient unavailable'; end if;
  insert into public.manual_patient_communications(organization_id,clinic_id,patient_id,actor_id,channel,direction,summary,occurred_at)
  values(oid,cid,pid,auth.uid(),channel_value,direction_value,trim(summary_value),coalesce(occurred,now())) returning id into created_id;
  insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata)
  values(oid,cid,auth.uid(),'patient_communication_recorded','patients',pid,jsonb_build_object('communication_id',created_id,'channel',channel_value,'direction',direction_value));
  return created_id;
end $$;
revoke all on function public.record_patient_communication(uuid,uuid,text,text,text,timestamptz) from public,anon;
grant execute on function public.record_patient_communication(uuid,uuid,text,text,text,timestamptz) to authenticated;
