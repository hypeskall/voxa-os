-- Record opening a prepared conversation without claiming a message was sent.
create or replace function public.open_whatsapp_reminder(cid uuid, aid uuid)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare item public.appointments; opened_at timestamptz=clock_timestamp();
begin
  if not private.has_permission(cid,'appointments.manage') then raise exception 'Access denied' using errcode='42501'; end if;
  select * into item from public.appointments where id=aid and clinic_id=cid;
  if item.id is null then raise exception 'Appointment unavailable'; end if;
  if not exists(select 1 from public.patients p where p.id=item.patient_id and p.clinic_id=cid and nullif(trim(p.phone),'') is not null) then raise exception 'Patient phone unavailable'; end if;
  insert into public.manual_patient_communications(organization_id,clinic_id,patient_id,actor_id,channel,direction,summary,occurred_at)
  values(item.organization_id,cid,item.patient_id,auth.uid(),'WHATSAPP','OUTBOUND','Memento WhatsApp deschis. Trimiterea mesajului nu este confirmată.',opened_at);
  insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata)
  values(item.organization_id,cid,auth.uid(),'WHATSAPP_REMINDER_OPENED','appointments',aid,jsonb_build_object('appointment_id',aid));
  return opened_at;
end $$;

revoke all on function public.open_whatsapp_reminder(uuid,uuid) from public,anon;
grant execute on function public.open_whatsapp_reminder(uuid,uuid) to authenticated;
