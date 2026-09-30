alter table public.clinics
  add column if not exists whatsapp_reminder_template text not null
  default 'Bună ziua, {{patient_first_name}}. Vă reamintim că mâine, {{date}}, la ora {{time}}, aveți o programare la {{clinic_name}}, {{clinic_address}}. Dacă nu mai puteți ajunge, vă rugăm să ne anunțați. Vă mulțumim.';

alter table public.clinics drop constraint if exists clinics_whatsapp_reminder_template_length;
alter table public.clinics add constraint clinics_whatsapp_reminder_template_length
  check (char_length(whatsapp_reminder_template) between 20 and 4000);

create or replace function public.open_whatsapp_reminder(cid uuid, aid uuid) returns timestamptz
language plpgsql security definer set search_path='' as $$
declare item public.appointments; opened_at timestamptz=clock_timestamp();
begin
  if not private.has_permission(cid,'appointments.manage') then raise exception 'Access denied' using errcode='42501'; end if;
  select * into item from public.appointments where id=aid and clinic_id=cid;
  if item.id is null then raise exception 'Appointment unavailable'; end if;
  if not exists(select 1 from public.patients p where p.id=item.patient_id and p.clinic_id=cid and nullif(trim(p.phone),'') is not null) then raise exception 'Patient phone unavailable'; end if;
  insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata)
  values(item.organization_id,cid,auth.uid(),'WHATSAPP_REMINDER_OPENED','appointments',aid,jsonb_build_object('appointment_id',aid));
  return opened_at;
end $$;

create or replace function public.tomorrow_whatsapp_reminders(cid uuid, local_day date default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare tz text; day_value date; range_start timestamptz; range_end timestamptz;
begin
  if not private.has_permission(cid,'appointments.read') then raise exception 'Access denied' using errcode='42501'; end if;
  select timezone into tz from public.clinics where id=cid and archived_at is null;
  if tz is null then raise exception 'Clinic unavailable'; end if;
  day_value=coalesce(local_day,(now() at time zone tz)::date)+1;
  range_start=day_value::timestamp at time zone tz; range_end=(day_value+1)::timestamp at time zone tz;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.start_at,x.id) from (
    select a.id,a.patient_id,a.start_at,a.end_at,a.status,p.name patient_name,p.phone patient_phone,
      s.name service_name,d.name doctor_name
    from public.appointments a
    join public.patients p on p.id=a.patient_id and p.clinic_id=a.clinic_id
    join public.services s on s.id=a.service_id and s.clinic_id=a.clinic_id
    left join public.clinic_doctors d on d.id=a.doctor_location_id and d.clinic_id=a.clinic_id
    where a.clinic_id=cid and a.start_at>=range_start and a.start_at<range_end
      and a.status not in ('CANCELLED','COMPLETED','NO_SHOW') and nullif(trim(p.phone),'') is not null
  ) x),'[]'::jsonb);
end $$;

revoke all on function public.open_whatsapp_reminder(uuid,uuid), public.tomorrow_whatsapp_reminders(uuid,date) from public,anon;
grant execute on function public.open_whatsapp_reminder(uuid,uuid), public.tomorrow_whatsapp_reminders(uuid,date) to authenticated;

-- Only records explicitly marked as development demonstrations are renamed.
with demo_names(seq,name) as (values
  (1,'Andrei Popescu'),(2,'Ioana Marinescu'),(3,'Radu Ionescu'),(4,'Elena Dumitrescu'),(5,'Mara Stan'),
  (6,'Vlad Georgescu'),(7,'Diana Pavel'),(8,'Sorin Matei'),(9,'Alina Tudor'),(10,'Cătălin Enache'),
  (11,'Cristina Dobre'),(12,'Mihai Nistor'),(13,'Laura Petrescu'),(14,'Daniel Ilie'),(15,'Oana Rusu'),
  (16,'Paul Munteanu'),(17,'Bianca Neagu'),(18,'Adrian Lupu'),(19,'Simona Stoica'),(20,'Robert Preda'),
  (21,'Irina Voicu'),(22,'Ștefan Sandu'),(23,'Anca Florea'),(24,'Victor Barbu'),(25,'Monica Oprea'),
  (26,'Alexandru Toma'),(27,'Gabriela Dinu'),(28,'Rareș Mocanu'),(29,'Nicoleta Ene'),(30,'Lucian Dragomir')
)
update public.patients p set name=d.name
from demo_names d
where p.internal_id ~ '^(DEMO-P-|CM-DEMO-P-)[0-9]+$' and substring(p.internal_id from '[0-9]+$')::int=d.seq;

update public.patients p set phone='+4070000'||lpad(substring(p.internal_id from '[0-9]+$'),4,'0'),
  email='pacient.demo.'||substring(p.internal_id from '[0-9]+$')||'@example.invalid',
  administrative_notes='Înregistrare sintetică pentru demonstrație. Nu reprezintă o persoană reală.'
where p.internal_id ~ '^(DEMO-P-|CM-DEMO-P-)[0-9]+$';
