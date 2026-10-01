-- Keep the complete daily schedule visible, including overdue and completed visits.
create or replace function public.operational_dashboard(cid uuid,local_day date default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare tz text; day_value date; range_start timestamptz; range_end timestamptz;
 can_schedule boolean; configured_minutes numeric; booked_minutes numeric; result jsonb;
begin
 if not private.has_permission(cid,'clinic.read') then raise exception 'Access denied' using errcode='42501'; end if;
 select timezone into tz from public.clinics where id=cid and archived_at is null;
 if tz is null then raise exception 'Clinic unavailable'; end if;
 day_value=coalesce(local_day,(now() at time zone tz)::date);
 if day_value < (now() at time zone tz)::date-366 or day_value > (now() at time zone tz)::date+366 then raise exception 'Invalid date'; end if;
 range_start=day_value::timestamp at time zone tz;
 range_end=(day_value+1)::timestamp at time zone tz;
 can_schedule=private.has_permission(cid,'appointments.read');

 if not can_schedule then
  return jsonb_build_object('date',day_value,'can_view_schedule',false,'metrics',jsonb_build_object(),
   'upcoming','[]'::jsonb,'activity','[]'::jsonb,'alerts','[]'::jsonb);
 end if;

 select coalesce(sum(extract(epoch from (a.end_time-a.start_time))/60),0)*greatest(1,(select count(*) from public.rooms r where r.clinic_id=cid and r.active and r.archived_at is null)) into configured_minutes
 from public.availability_rules a where a.clinic_id=cid and a.resource_kind='clinic' and a.interval_kind='work'
  and a.active and a.archived_at is null and a.weekday=extract(isodow from day_value)::integer
  and day_value>=a.valid_from and (a.valid_until is null or day_value<=a.valid_until);
 select coalesce(sum(extract(epoch from (least(a.occupied_end_at,range_end)-greatest(a.occupied_start_at,range_start)))/60),0) into booked_minutes
 from public.appointments a where a.clinic_id=cid and a.status<>'CANCELLED'
  and a.occupied_start_at<range_end and a.occupied_end_at>range_start;

 select jsonb_build_object(
  'date',day_value,'can_view_schedule',true,
  'metrics',jsonb_build_object(
   'appointments',count(*) filter(where a.status<>'CANCELLED'),
   'confirmed',count(*) filter(where a.status='CONFIRMED'),
   'pending',count(*) filter(where a.status='PENDING'),
   'completed',count(*) filter(where a.status='COMPLETED'),
   'cancelled',count(*) filter(where a.status='CANCELLED'),
   'no_show',count(*) filter(where a.status='NO_SHOW'),
   'occupancy_percent',case when configured_minutes>0 then least(999,round(booked_minutes*100/configured_minutes,1)) else null end),
  'upcoming',coalesce((select jsonb_agg(to_jsonb(x) order by x.start_at,x.id) from (
    select a.id,a.patient_id,a.start_at,a.end_at,a.status,p.name patient_name,s.name service_name,
     d.name doctor_name,(select max(r.name) from public.appointment_resources ar join public.rooms r on r.id=ar.room_id and r.clinic_id=ar.clinic_id where ar.clinic_id=cid and ar.appointment_id=a.id) room_name
    from public.appointments a join public.patients p on p.id=a.patient_id and p.clinic_id=a.clinic_id
    join public.services s on s.id=a.service_id and s.clinic_id=a.clinic_id
    left join public.clinic_doctors d on d.id=a.doctor_location_id and d.clinic_id=a.clinic_id
    where a.clinic_id=cid and a.end_at>range_start and a.start_at<range_end and a.status<>'CANCELLED'
    order by a.start_at,a.id) x),'[]'::jsonb),
  'activity',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id) from (
    select h.id,h.appointment_id,h.event,h.created_at,coalesce(pr.full_name,'Sistem') actor_name,p.name patient_name
    from public.appointment_history h join public.appointments a on a.id=h.appointment_id and a.clinic_id=h.clinic_id
    join public.patients p on p.id=a.patient_id and p.clinic_id=a.clinic_id left join public.profiles pr on pr.id=h.actor_id
    where h.clinic_id=cid and h.created_at>=range_start and h.created_at<range_end order by h.created_at desc limit 12) x),'[]'::jsonb),
  'alerts',jsonb_build_array(
   jsonb_build_object('code','PENDING','label','Programări în așteptarea confirmării','count',count(*) filter(where a.status='PENDING'),'tone','warning'),
   jsonb_build_object('code','NO_SHOW','label','Neprezentări astăzi','count',count(*) filter(where a.status='NO_SHOW'),'tone','critical'),
   jsonb_build_object('code','FAILED_NOTIFICATIONS','label','Comunicări eșuate','count',case when private.has_permission(cid,'notifications.read') then (select count(*) from public.notification_jobs n where n.clinic_id=cid and n.status='FAILED' and n.created_at>=range_start and n.created_at<range_end) else 0 end,'tone','critical'),
   jsonb_build_object('code','BLOCKS','label','Indisponibilități active','count',case when private.has_permission(cid,'availability.read') then (select count(*) from public.schedule_exceptions e where e.clinic_id=cid and e.active and e.archived_at is null and e.exception_kind<>'extra_work' and e.starts_at<range_end and e.ends_at>range_start) else 0 end,'tone','neutral')
  )
 ) into result
 from public.appointments a where a.clinic_id=cid and a.start_at<range_end and a.end_at>range_start;
 return result;
end $$;

