-- Development data repair for the explicitly marked Clinica Maria demo resources.
do $$
declare clinic_row record; resource record; day integer;
begin
  for clinic_row in select distinct cl.id,cl.organization_id from public.clinics cl
    join public.doctor_locations dl on dl.clinic_id=cl.id
    join public.doctors d on d.id=dl.doctor_id
    where d.professional_code like 'CM-DEMO-MED-%'
  loop
    for resource in
      select 'doctor'::text kind,dl.id resource_id from public.doctor_locations dl join public.doctors d on d.id=dl.doctor_id where dl.clinic_id=clinic_row.id and d.professional_code like 'CM-DEMO-MED-%' and dl.active and dl.archived_at is null
      union all select 'room',r.id from public.rooms r where r.clinic_id=clinic_row.id and r.active and r.archived_at is null
      union all select 'equipment',e.id from public.equipment e where e.clinic_id=clinic_row.id and e.active and e.archived_at is null
    loop
      for day in 1..5 loop
        if not exists(select 1 from public.availability_rules a where a.clinic_id=clinic_row.id and a.resource_kind=resource.kind and coalesce(a.doctor_location_id,a.room_id,a.equipment_id)=resource.resource_id and a.weekday=day and a.interval_kind='work' and a.active and a.archived_at is null) then
          insert into public.availability_rules(organization_id,clinic_id,name,resource_kind,doctor_location_id,room_id,equipment_id,weekday,start_time,end_time,valid_from,interval_kind,active)
          values(clinic_row.organization_id,clinic_row.id,'Program demonstrativ 08:00–20:00',resource.kind,
            case when resource.kind='doctor' then resource.resource_id end,
            case when resource.kind='room' then resource.resource_id end,
            case when resource.kind='equipment' then resource.resource_id end,
            day,time '08:00',time '20:00',date '2026-01-01','work',true);
        end if;
      end loop;
    end loop;
  end loop;
end $$;
