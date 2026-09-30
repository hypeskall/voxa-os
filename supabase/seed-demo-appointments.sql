-- DEVELOPMENT/DEMO ONLY. Never run automatically in production.
-- Creates synthetic patients and a current-day calendar so the operational
-- dashboard can be evaluated without using personal data.

do $$
declare
  cid uuid;
  oid uuid;
  actor uuid;
  local_day date := (now() at time zone 'Europe/Bucharest')::date;
  item record;
  v_patient_id uuid;
  v_service_id uuid;
  v_doctor_location_id uuid;
  v_appointment_id uuid;
  v_room_id uuid;
  v_equipment_id uuid;
  starts_at timestamptz;
  ends_at timestamptz;
  duration integer;
begin
  select c.id, c.organization_id, p.id into cid, oid, actor
  from public.clinics c
  join public.clinic_memberships cm on cm.clinic_id = c.id and cm.active
  join auth.users u on u.id = cm.user_id
  join public.profiles p on p.id = u.id
  where lower(u.email) = 'mihairoman144@gmail.com'
  order by cm.created_at
  limit 1;

  if cid is null then
    raise exception 'Demo appointments require the Clinica Maria user membership.';
  end if;

  delete from public.appointment_history h
  using public.appointments a
  where h.appointment_id = a.id and a.clinic_id = cid and a.notes like 'CM_DEMO_APPT_%';
  delete from public.appointment_resources ar
  using public.appointments a
  where ar.appointment_id = a.id and a.clinic_id = cid and a.notes like 'CM_DEMO_APPT_%';
  delete from public.appointments where clinic_id = cid and notes like 'CM_DEMO_APPT_%';

  for item in
    select * from (values
      (1, 'Andrei Popescu', 'Ecografie generală (abdomen + pelvis)', 'CM-DEMO-MED-001', time '08:10', 'COMPLETED'::public.appointment_status),
      (2, 'Ioana Marinescu', 'EKG', 'CM-DEMO-MED-018', time '09:00', 'COMPLETED'::public.appointment_status),
      (3, 'Radu Ionescu', 'CT craniu fără substanță de contrast', 'CM-DEMO-MED-002', time '10:00', 'ARRIVED'::public.appointment_status),
      (4, 'Elena Dumitrescu', 'Consultație gastroenterologie', 'CM-DEMO-MED-022', time '11:00', 'IN_PROGRESS'::public.appointment_status),
      (5, 'Mara Stan', 'RMN cranio-cerebral nativ', 'CM-DEMO-MED-003', time '12:00', 'CONFIRMED'::public.appointment_status),
      (6, 'Vlad Georgescu', 'Ecocardiografie + Doppler Color', 'CM-DEMO-MED-019', time '13:00', 'CONFIRMED'::public.appointment_status),
      (7, 'Diana Pavel', 'Mamografie digitală 2D bilaterală', 'CM-DEMO-MED-004', time '14:00', 'PENDING'::public.appointment_status),
      (8, 'Sorin Matei', 'Consultație neurochirurgie', 'CM-DEMO-MED-021', time '15:00', 'CONFIRMED'::public.appointment_status),
      (9, 'Alina Tudor', 'Holter EKG 24 h', 'CM-DEMO-MED-020', time '16:00', 'PENDING'::public.appointment_status),
      (10, 'Cătălin Enache', 'RMN coloană vertebrală nativ', 'CM-DEMO-MED-005', time '17:00', 'CONFIRMED'::public.appointment_status)
    ) as v(seq, patient_name, service_name, doctor_code, start_time, status)
  loop
    insert into public.patients(
      organization_id, clinic_id, name, internal_id, phone, email, city,
      administrative_notes, active, archived_at
    ) values (
      oid, cid, item.patient_name, 'CM-DEMO-P-' || lpad(item.seq::text, 2, '0'),
      '+4070000' || lpad(item.seq::text, 4, '0'), 'pacient.demo.' || item.seq || '@example.invalid', 'Oradea', 'Înregistrare sintetică pentru demonstrație. Nu reprezintă o persoană reală.', true, null
    )
    on conflict (clinic_id, internal_id) do update
      set name = excluded.name, administrative_notes = excluded.administrative_notes,
          active = true, archived_at = null, updated_at = now()
    returning id into v_patient_id;

    select s.id, s.duration_minutes into v_service_id, duration
    from public.services s where s.clinic_id = cid and s.name = item.service_name;

    select dl.id into v_doctor_location_id
    from public.doctor_locations dl join public.doctors d on d.id = dl.doctor_id
    where dl.clinic_id = cid and d.professional_code = item.doctor_code;

    starts_at := (local_day + item.start_time)::timestamp at time zone 'Europe/Bucharest';
    ends_at := starts_at + make_interval(mins => duration);

    insert into public.appointments(
      organization_id, clinic_id, patient_id, service_id, doctor_location_id,
      start_at, end_at, occupied_start_at, occupied_end_at,
      duration_minutes, buffer_before, buffer_after, status, source,
      notes, cancellation_reason, created_by
    ) values (
      oid, cid, v_patient_id, v_service_id, v_doctor_location_id,
      starts_at, ends_at, starts_at, ends_at,
      duration, 0, 0, item.status, 'RECEPTION',
      'CM_DEMO_APPT_' || lpad(item.seq::text, 2, '0'), '', actor
    ) returning id into v_appointment_id;

    select sr.room_id into v_room_id
    from public.service_rooms sr where sr.clinic_id = cid and sr.service_id = v_service_id
    order by sr.room_id limit 1;
    if v_room_id is not null then
      insert into public.appointment_resources(
        organization_id, clinic_id, appointment_id, resource_kind, room_id, capacity_units
      ) values (oid, cid, v_appointment_id, 'room', v_room_id, 1);
    end if;

    select se.equipment_id into v_equipment_id
    from public.service_equipment se where se.clinic_id = cid and se.service_id = v_service_id
    order by se.equipment_id limit 1;
    if v_equipment_id is not null then
      insert into public.appointment_resources(
        organization_id, clinic_id, appointment_id, resource_kind, equipment_id, capacity_units
      ) values (oid, cid, v_appointment_id, 'equipment', v_equipment_id, 1);
    end if;

    insert into public.appointment_history(
      organization_id, clinic_id, appointment_id, event, actor_id, new_values, reason
    ) values (
      oid, cid, v_appointment_id, 'CREATED', actor,
      jsonb_build_object('demo', true, 'status', item.status),
      'Date sintetice pentru demonstrație'
    );
  end loop;
end $$;
