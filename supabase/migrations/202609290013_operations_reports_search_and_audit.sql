-- Administrative operations: compact dashboard, reports, global search and
-- persisted workspace preferences. All clinical reads remain permission and
-- tenant scoped inside PostgreSQL.

insert into public.permissions(key,description) values
 ('reports.read','Vizualizare rapoarte operaționale')
on conflict (key) do nothing;

insert into public.role_permissions(role,permission) values
 ('OWNER','reports.read'),('ADMIN','reports.read')
on conflict do nothing;

alter table public.user_preferences
 add column visible_columns jsonb not null default '{}'::jsonb
  check(jsonb_typeof(visible_columns)='object' and pg_column_size(visible_columns)<=8192),
 add column dashboard_modules text[] not null default array['metrics','upcoming','alerts','activity']::text[]
  check(dashboard_modules <@ array['metrics','upcoming','alerts','activity']::text[] and cardinality(dashboard_modules)<=4);

grant insert(user_id,visible_columns,dashboard_modules),update(visible_columns,dashboard_modules)
 on public.user_preferences to authenticated;

create index audit_actor_time on public.audit_logs(clinic_id,actor_id,created_at desc);
create index audit_action_entity_time on public.audit_logs(clinic_id,action,entity,created_at desc);
create index doctors_name_search on public.doctors(organization_id,lower(name),id);
create index services_name_search on public.services(clinic_id,lower(name),id) where archived_at is null;
create index documents_title_search on public.patient_documents(clinic_id,lower(title),id) where archived_at is null;

create function public.operational_dashboard(cid uuid,local_day date default null) returns jsonb
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
    where a.clinic_id=cid and a.start_at>=greatest(range_start,now()) and a.start_at<range_end and a.status<>'CANCELLED'
    order by a.start_at,a.id limit 12) x),'[]'::jsonb),
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

create function public.reports_summary(cid uuid,date_from date,date_to date,doctor_filter uuid default null,service_filter uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare tz text; range_start timestamptz; range_end timestamptz; configured_minutes numeric; booked_minutes numeric; result jsonb;
begin
 if not private.has_permission(cid,'reports.read') then raise exception 'Access denied' using errcode='42501'; end if;
 if date_from is null or date_to is null or date_to<date_from or date_to>date_from+366 then raise exception 'Invalid report range'; end if;
 select timezone into tz from public.clinics where id=cid and archived_at is null;
 if tz is null then raise exception 'Clinic unavailable'; end if;
 if doctor_filter is not null and not exists(select 1 from public.doctor_locations d where d.id=doctor_filter and d.clinic_id=cid) then raise exception 'Invalid doctor'; end if;
 if service_filter is not null and not exists(select 1 from public.services s where s.id=service_filter and s.clinic_id=cid) then raise exception 'Invalid service'; end if;
 range_start=date_from::timestamp at time zone tz; range_end=(date_to+1)::timestamp at time zone tz;

 select coalesce(sum(extract(epoch from (a.end_time-a.start_time))/60),0)*greatest(1,(select count(*) from public.rooms r where r.clinic_id=cid and r.active and r.archived_at is null)) into configured_minutes
 from pg_catalog.generate_series(date_from,date_to,interval '1 day') g(day)
 join public.availability_rules a on a.clinic_id=cid and a.resource_kind='clinic' and a.interval_kind='work'
  and a.active and a.archived_at is null and a.weekday=extract(isodow from g.day)::integer
  and g.day::date>=a.valid_from and (a.valid_until is null or g.day::date<=a.valid_until);
 select coalesce(sum(extract(epoch from (a.occupied_end_at-a.occupied_start_at))/60),0) into booked_minutes
 from public.appointments a where a.clinic_id=cid and a.status<>'CANCELLED' and a.start_at>=range_start and a.start_at<range_end
  and (doctor_filter is null or a.doctor_location_id=doctor_filter) and (service_filter is null or a.service_id=service_filter);

 with filtered as (
  select a.* from public.appointments a where a.clinic_id=cid and a.start_at>=range_start and a.start_at<range_end
   and (doctor_filter is null or a.doctor_location_id=doctor_filter) and (service_filter is null or a.service_id=service_filter)
 )
 select jsonb_build_object(
  'from',date_from,'to',date_to,
  'summary',jsonb_build_object('total',count(*),'cancelled',count(*) filter(where status='CANCELLED'),
   'no_show',count(*) filter(where status='NO_SHOW'),'completed',count(*) filter(where status='COMPLETED'),
   'occupancy_percent',case when configured_minutes>0 then least(999,round(booked_minutes*100/configured_minutes,1)) else null end),
  'by_status',coalesce((select jsonb_agg(jsonb_build_object('label',status,'count',amount) order by status) from (select status::text status,count(*) amount from filtered group by status) s),'[]'::jsonb),
  'by_source',coalesce((select jsonb_agg(jsonb_build_object('label',source,'count',amount) order by source) from (select source::text source,count(*) amount from filtered group by source) s),'[]'::jsonb),
  'by_doctor',coalesce((select jsonb_agg(to_jsonb(x) order by x.count desc,x.name) from (select coalesce(d.name,'Nealocat') name,count(*) count from filtered f left join public.clinic_doctors d on d.id=f.doctor_location_id and d.clinic_id=f.clinic_id group by d.name) x),'[]'::jsonb),
  'by_service',coalesce((select jsonb_agg(to_jsonb(x) order by x.count desc,x.name) from (select s.name,count(*) count from filtered f join public.services s on s.id=f.service_id and s.clinic_id=f.clinic_id group by s.name) x),'[]'::jsonb),
  'resources',coalesce((select jsonb_agg(to_jsonb(x) order by x.kind,x.booked_minutes desc,x.name) from (
    select ar.resource_kind kind,coalesce(r.name,e.name) name,count(distinct ar.appointment_id) appointment_count,
     round(sum(extract(epoch from (f.occupied_end_at-f.occupied_start_at))/60*ar.capacity_units)) booked_minutes
    from filtered f join public.appointment_resources ar on ar.appointment_id=f.id and ar.clinic_id=f.clinic_id
    left join public.rooms r on r.id=ar.room_id and r.clinic_id=ar.clinic_id left join public.equipment e on e.id=ar.equipment_id and e.clinic_id=ar.clinic_id
    where f.status<>'CANCELLED' group by ar.resource_kind,r.name,e.name) x),'[]'::jsonb)
 ) into result from filtered;
 return result;
end $$;

create function public.global_search(cid uuid,search_query text,result_limit integer default 24) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare q text=lower(trim(coalesce(search_query,''))); maximum integer=least(greatest(coalesce(result_limit,24),1),40); result jsonb;
begin
 if not private.has_permission(cid,'clinic.read') then raise exception 'Access denied' using errcode='42501'; end if;
 if length(q)<2 or length(q)>80 then return '[]'::jsonb; end if;
 with matches as (
  select 'patient' kind,p.id,p.name title,concat_ws(' · ',nullif(p.internal_id,''),nullif(p.phone,'')) subtitle,
   '/clinics/'||cid||'/patients/'||p.id href,case when lower(p.name) like q||'%' then 0 else 1 end rank
  from public.patients p where private.has_permission(cid,'patients.read') and p.clinic_id=cid and p.active and p.archived_at is null
   and (position(q in lower(p.name))>0 or position(q in lower(p.internal_id))>0 or position(q in lower(p.phone))>0 or position(q in lower(p.email))>0)
  union all
  select 'doctor',d.id,d.name,coalesce(nullif(d.professional_code,''),'Medic'),'/clinics/'||cid||'/doctors/'||d.id,case when lower(d.name) like q||'%' then 0 else 1 end
  from public.clinic_doctors d where private.has_permission(cid,'catalog.read') and d.clinic_id=cid and d.active and d.archived_at is null
   and (position(q in lower(d.name))>0 or position(q in lower(d.professional_code))>0)
  union all
  select 'service',s.id,s.name,coalesce(c.name,'Serviciu'),'/clinics/'||cid||'/services/'||s.id,case when lower(s.name) like q||'%' then 0 else 1 end
  from public.services s left join public.service_categories c on c.id=s.category_id and c.clinic_id=s.clinic_id
  where private.has_permission(cid,'catalog.read') and s.clinic_id=cid and s.active and s.archived_at is null and position(q in lower(s.name))>0
  union all
  select 'appointment',a.id,p.name,s.name||' · '||to_char(a.start_at at time zone cl.timezone,'DD.MM.YYYY HH24:MI'),
   '/clinics/'||cid||'/calendar?date='||to_char(a.start_at at time zone cl.timezone,'YYYY-MM-DD')||'&appointment='||a.id,
   case when lower(p.name) like q||'%' then 0 else 1 end
  from public.appointments a join public.patients p on p.id=a.patient_id and p.clinic_id=a.clinic_id
  join public.services s on s.id=a.service_id and s.clinic_id=a.clinic_id join public.clinics cl on cl.id=a.clinic_id
  where private.has_permission(cid,'appointments.read') and a.clinic_id=cid
   and (position(q in lower(p.name))>0 or position(q in lower(p.internal_id))>0 or position(q in lower(s.name))>0)
  union all
  select 'document',pd.id,pd.title,p.name||' · '||dt.name,'/clinics/'||cid||'/patients/'||p.id||'?tab=documents',case when lower(pd.title) like q||'%' then 0 else 1 end
  from public.patient_documents pd join public.patients p on p.id=pd.patient_id and p.clinic_id=pd.clinic_id
  join public.document_types dt on dt.id=pd.document_type_id and dt.clinic_id=pd.clinic_id
  where private.has_permission(cid,'documents.read') and pd.clinic_id=cid and pd.archived_at is null
   and (position(q in lower(pd.title))>0 or position(q in lower(p.name))>0)
 ), limited as (select * from matches order by rank,lower(title),kind,id limit maximum)
 select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'id',id,'title',title,'subtitle',subtitle,'href',href) order by rank,lower(title),kind),'[]') into result from limited;
 return result;
end $$;

create function public.record_report_export(cid uuid,date_from date,date_to date) returns void
language plpgsql security definer set search_path='' as $$
declare oid uuid; begin
 if not private.has_permission(cid,'reports.read') then raise exception 'Access denied' using errcode='42501'; end if;
 if date_from is null or date_to is null or date_to<date_from or date_to>date_from+366 then raise exception 'Invalid report range'; end if;
 select organization_id into oid from public.clinics where id=cid and archived_at is null;
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata)
 values(oid,cid,auth.uid(),'export','reports',cid,jsonb_build_object('from',date_from,'to',date_to,'format','csv'));
end $$;

revoke all on function public.operational_dashboard(uuid,date),public.reports_summary(uuid,date,date,uuid,uuid),public.global_search(uuid,text,integer),public.record_report_export(uuid,date,date) from public,anon;
grant execute on function public.operational_dashboard(uuid,date),public.reports_summary(uuid,date,date,uuid,uuid),public.global_search(uuid,text,integer),public.record_report_export(uuid,date,date) to authenticated;
