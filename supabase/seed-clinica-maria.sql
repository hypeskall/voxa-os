-- Idempotent installation seed for the Clinica Maria demo environment.
-- The published doctor/service names are real. Internal identifiers, durations,
-- buffers and resource allocation are configurable DEMO DEFAULTS, not confirmed
-- operational or contractual data from the clinic.
-- This file intentionally contains no real patient data.

do $$
declare
  cid uuid;
  oid uuid;
  item record;
  v_doctor_id uuid;
  v_doctor_location_id uuid;
  v_speciality_id uuid;
  v_service_id uuid;
  v_category_id uuid;
  v_room_id uuid;
  v_equipment_id uuid;
  v_equipment_group uuid;
begin
  select c.id, c.organization_id into cid, oid
  from public.clinics c
  join public.clinic_memberships cm on cm.clinic_id = c.id and cm.active
  join auth.users u on u.id = cm.user_id
  where lower(u.email) = 'mihairoman144@gmail.com'
  order by cm.created_at
  limit 1;

  if cid is null and (select count(*) from public.clinics) = 1 then
    select id, organization_id into cid, oid from public.clinics limit 1;
  end if;

  if cid is null then
    raise exception 'Clinica Maria seed requires one unambiguous target clinic.';
  end if;

  update public.organizations
  set name = 'Centrul de Sănătate și Imagistică Medicală Maria', updated_at = now()
  where id = oid;

  update public.clinics
  set name = 'Clinica Maria',
      address = 'Strada Sovata nr. 20, Oradea, România',
      phone = '+40 359 455 477',
      phone_secondary = '+40 359 455 488',
      email = 'info@clinica-maria.ro',
      timezone = 'Europe/Bucharest',
      booking_slug = 'clinica-maria-oradea',
      updated_at = now()
  where id = cid;

  for item in
    select * from (values
      ('Radiodiagnostic și imagistică medicală', 'Specialitate publicată de Clinica Maria.'),
      ('Cardiologie', 'Specialitate publicată de Clinica Maria.'),
      ('Neurochirurgie', 'Specialitate publicată de Clinica Maria.'),
      ('Gastroenterologie', 'Specialitate publicată de Clinica Maria.'),
      ('A.T.I.', 'Specialitate publicată de Clinica Maria.'),
      ('Neurologie', 'Specialitate publicată de Clinica Maria.'),
      ('Pediatrie', 'Specialitate publicată de Clinica Maria.'),
      ('Pneumologie', 'Specialitate publicată de Clinica Maria.'),
      ('Diabet zaharat, nutriție și boli metabolice', 'Specialitate publicată de Clinica Maria.')
    ) as v(name, description)
  loop
    insert into public.specialities(organization_id, clinic_id, name, description, active, archived_at)
    values (oid, cid, item.name, item.description, true, null)
    on conflict (clinic_id, name) do update
      set description = excluded.description, active = true, archived_at = null, updated_at = now();
  end loop;

  for item in
    select * from (values
      ('Ecografie', 'Investigații ecografice.'),
      ('Mamografie / ecografie mamară', 'Investigații mamare.'),
      ('Computer tomograf', 'Investigații CT.'),
      ('RMN', 'Investigații prin rezonanță magnetică.'),
      ('Neurochirurgie', 'Consultații și proceduri de neurochirurgie.'),
      ('Cardiologie', 'Consultații și investigații cardiologice.'),
      ('Gastroenterologie', 'Consultații și investigații gastroenterologice.')
    ) as v(name, description)
  loop
    insert into public.service_categories(organization_id, clinic_id, name, description, active, archived_at)
    values (oid, cid, item.name, item.description, true, null)
    on conflict (clinic_id, name) do update
      set description = excluded.description, active = true, archived_at = null, updated_at = now();
  end loop;

  for item in
    select * from (values
      ('Cabinet RMN', 'Imagistică RMN', 1),
      ('Cabinet CT', 'Imagistică CT', 1),
      ('Cabinet Mamografie', 'Imagistică mamară', 1),
      ('Cabinet Ecografie 1', 'Ecografie', 1),
      ('Cabinet Ecografie 2', 'Ecografie', 1),
      ('Cabinet Cardiologie', 'Cardiologie', 1),
      ('Cabinet Neurochirurgie', 'Neurochirurgie', 1),
      ('Cabinet Gastroenterologie', 'Gastroenterologie', 1)
    ) as v(name, type, capacity)
  loop
    insert into public.rooms(organization_id, clinic_id, name, type, capacity, active, archived_at)
    values (oid, cid, item.name, item.type, item.capacity, true, null)
    on conflict (clinic_id, name) do update
      set type = excluded.type, capacity = excluded.capacity, active = true, archived_at = null, updated_at = now();
  end loop;

  for item in
    select * from (values
      ('Aparat RMN', 'Imagistică RMN', 'CM-DEMO-EQ-RMN', 'Cabinet RMN'),
      ('Computer tomograf', 'Imagistică CT', 'CM-DEMO-EQ-CT', 'Cabinet CT'),
      ('Mamograf digital', 'Mamografie', 'CM-DEMO-EQ-MAMO', 'Cabinet Mamografie'),
      ('Ecograf 1', 'Ecografie', 'CM-DEMO-EQ-ECO-1', 'Cabinet Ecografie 1'),
      ('Ecograf 2', 'Ecografie', 'CM-DEMO-EQ-ECO-2', 'Cabinet Ecografie 2'),
      ('EKG', 'Cardiologie', 'CM-DEMO-EQ-EKG', 'Cabinet Cardiologie'),
      ('Holter EKG', 'Cardiologie', 'CM-DEMO-EQ-HOLTER-EKG', 'Cabinet Cardiologie'),
      ('Holter TA', 'Cardiologie', 'CM-DEMO-EQ-HOLTER-TA', 'Cabinet Cardiologie'),
      ('Echipament test de efort', 'Cardiologie', 'CM-DEMO-EQ-EFORT', 'Cabinet Cardiologie')
    ) as v(name, type, internal_id, room_name)
  loop
    select id into v_room_id from public.rooms where clinic_id = cid and name = item.room_name;
    insert into public.equipment(organization_id, clinic_id, name, type, internal_id, room_id, capacity, active, archived_at)
    values (oid, cid, item.name, item.type, item.internal_id, v_room_id, 1, true, null)
    on conflict (clinic_id, internal_id) do update
      set name = excluded.name, type = excluded.type, room_id = excluded.room_id,
          capacity = excluded.capacity, active = true, archived_at = null, updated_at = now();
  end loop;

  -- CM-DEMO-MED-* values are internal application identifiers, not professional registry codes.
  for item in
    select * from (values
      ('Dr. Baican Virginia', 'CM-DEMO-MED-001', 'Radiodiagnostic și imagistică medicală'),
      ('Dr. Boanca Radu-Sebastian', 'CM-DEMO-MED-002', 'Radiodiagnostic și imagistică medicală'),
      ('Dr. Micle Liana-Monica', 'CM-DEMO-MED-003', 'Radiodiagnostic și imagistică medicală'),
      ('Dr. Morgovan Calin-Ionel', 'CM-DEMO-MED-004', 'Radiodiagnostic și imagistică medicală'),
      ('Dr. Motoi Sorin-Bogdan', 'CM-DEMO-MED-005', 'Radiodiagnostic și imagistică medicală'),
      ('Dr. Opris Ligia-Laura', 'CM-DEMO-MED-006', 'Radiodiagnostic și imagistică medicală'),
      ('Dr. Pralea Andreea-Cristina-Maria', 'CM-DEMO-MED-007', 'Radiodiagnostic și imagistică medicală'),
      ('Dr. Rotaru Monica', 'CM-DEMO-MED-008', 'Radiodiagnostic și imagistică medicală'),
      ('Dr. Sirca Galateea-Florenina', 'CM-DEMO-MED-009', 'Radiodiagnostic și imagistică medicală'),
      ('Dr. Stanca Florentina-Anca', 'CM-DEMO-MED-010', 'Radiodiagnostic și imagistică medicală'),
      ('Dr. Toc Liana-Maria', 'CM-DEMO-MED-011', 'Radiodiagnostic și imagistică medicală'),
      ('Dr. Toth Maria-Rozalia', 'CM-DEMO-MED-012', 'Radiodiagnostic și imagistică medicală'),
      ('Dr. Venter Alina-Cristiana', 'CM-DEMO-MED-013', 'Radiodiagnostic și imagistică medicală'),
      ('Dr. Vlad Raluca', 'CM-DEMO-MED-014', 'Radiodiagnostic și imagistică medicală'),
      ('Dr. Megyeri Daniela-Haiganusi', 'CM-DEMO-MED-015', 'Radiodiagnostic și imagistică medicală'),
      ('Dr. Tarau Ioana-Roxana', 'CM-DEMO-MED-016', 'Radiodiagnostic și imagistică medicală'),
      ('Dr. Crihana Danut', 'CM-DEMO-MED-017', 'Radiodiagnostic și imagistică medicală'),
      ('Dr. Bustea Cristiana-Magdalena', 'CM-DEMO-MED-018', 'Cardiologie'),
      ('Dr. Dragomir Dinu-Andrei', 'CM-DEMO-MED-019', 'Cardiologie'),
      ('Dr. Salajan Adriana-Maria', 'CM-DEMO-MED-020', 'Cardiologie'),
      ('Dr. Mohan Aurel-George', 'CM-DEMO-MED-021', 'Neurochirurgie'),
      ('Dr. Cordos Claudia', 'CM-DEMO-MED-022', 'Gastroenterologie'),
      ('Dr. Faur Lucian-Dan', 'CM-DEMO-MED-023', 'Gastroenterologie'),
      ('Dr. Pantis Carmen', 'CM-DEMO-MED-024', 'A.T.I.'),
      ('Dr. Gitlan Ion', 'CM-DEMO-MED-025', 'A.T.I.'),
      ('Dr. Fortis Florina', 'CM-DEMO-MED-026', 'Neurologie'),
      ('Dr. Comanescu Alexandra', 'CM-DEMO-MED-027', 'Neurologie'),
      ('Dr. Mihalceanu Rodica', 'CM-DEMO-MED-028', 'Pediatrie'),
      ('Dr. Marta Mircea', 'CM-DEMO-MED-029', 'Pneumologie'),
      ('Dr. Burescu Carmen-Romina', 'CM-DEMO-MED-030', 'Diabet zaharat, nutriție și boli metabolice')
    ) as v(name, internal_code, speciality_name)
  loop
    insert into public.doctors(organization_id, name, professional_code, email, phone)
    values (oid, item.name, item.internal_code, '', '')
    on conflict (organization_id, professional_code) do update
      set name = excluded.name, updated_at = now()
    returning id into v_doctor_id;

    insert into public.doctor_locations(organization_id, clinic_id, doctor_id, active, archived_at)
    values (oid, cid, v_doctor_id, true, null)
    on conflict (doctor_id, clinic_id) do update
      set active = true, archived_at = null, updated_at = now()
    returning id into v_doctor_location_id;

    select id into v_speciality_id from public.specialities where clinic_id = cid and name = item.speciality_name;
    insert into public.doctor_specialities(doctor_location_id, speciality_id, clinic_id)
    values (v_doctor_location_id, v_speciality_id, cid)
    on conflict do nothing;
  end loop;

  -- Durations and buffers below are editable DEMO DEFAULTS.
  for item in
    select * from (values
      ('Ecografie', 'Ecografie generală (abdomen + pelvis)', 40),
      ('Ecografie', 'Ecografie abdomen', 25),
      ('Ecografie', 'Ecografie pelvis', 25),
      ('Ecografie', 'Ecografie de vase (vene)', 30),
      ('Ecografie', 'Ecografie de vase (artere)', 30),
      ('Ecografie', 'Ecografie de organ (tiroidă, părți moi)', 20),
      ('Mamografie / ecografie mamară', 'Ecografie mamară bilaterală / senologie imagistică', 30),
      ('Mamografie / ecografie mamară', 'Mamografie digitală 2D bilaterală', 20),
      ('Mamografie / ecografie mamară', 'Mamografie cu tomosinteză bilaterală', 30),
      ('Computer tomograf', 'CT craniu nativ și cu substanță de contrast', 30),
      ('Computer tomograf', 'CT regiune gât nativ și cu substanță de contrast', 30),
      ('Computer tomograf', 'CT torace nativ și cu substanță de contrast', 30),
      ('Computer tomograf', 'CT abdomen nativ și cu substanță de contrast', 30),
      ('Computer tomograf', 'CT pelvis nativ și cu substanță de contrast', 30),
      ('Computer tomograf', 'CT coloană vertebrală nativ și cu substanță de contrast', 30),
      ('Computer tomograf', 'CT membre / segment nativ și cu substanță de contrast', 30),
      ('Computer tomograf', 'CT craniu fără substanță de contrast', 20),
      ('Computer tomograf', 'CT regiune gât fără substanță de contrast', 20),
      ('Computer tomograf', 'CT torace fără substanță de contrast', 20),
      ('Computer tomograf', 'CT abdomen fără substanță de contrast', 20),
      ('Computer tomograf', 'CT pelvis fără substanță de contrast', 20),
      ('Computer tomograf', 'CT coloană vertebrală fără substanță de contrast', 20),
      ('Computer tomograf', 'CT membre / segmente fără substanță de contrast', 20),
      ('Computer tomograf', 'CT ureche internă', 20),
      ('Computer tomograf', 'Angiografie CT', 40),
      ('Computer tomograf', 'UroCT', 35),
      ('RMN', 'RMN cranio-cerebral nativ', 35),
      ('RMN', 'RMN cranio-cerebral nativ și cu substanță de contrast', 50),
      ('RMN', 'RMN coloană vertebrală nativ', 35),
      ('RMN', 'RMN coloană vertebrală nativ și cu substanță de contrast', 50),
      ('RMN', 'RMN abdominal nativ', 40),
      ('RMN', 'RMN abdominal nativ și cu substanță de contrast', 50),
      ('RMN', 'Colangio RMN abdomen', 45),
      ('RMN', 'RMN pelvis nativ', 40),
      ('RMN', 'RMN pelvis nativ și cu substanță de contrast', 50),
      ('RMN', 'RMN extremități nativ', 35),
      ('RMN', 'RMN extremități cu substanță de contrast', 50),
      ('RMN', 'RMN umăr nativ', 35),
      ('RMN', 'RMN umăr nativ și cu substanță de contrast', 50),
      ('RMN', 'Angiografie RMN', 50),
      ('Neurochirurgie', 'Consultație neurochirurgie', 30),
      ('Neurochirurgie', 'Infiltrație epidurală', 45),
      ('Cardiologie', 'EKG', 15),
      ('Cardiologie', 'Ecocardiografie + Doppler Color', 35),
      ('Cardiologie', 'Pachet cardiologie: consultație + ecocardiografie + EKG', 75),
      ('Cardiologie', 'Ergometrie / test de efort', 45),
      ('Cardiologie', 'Holter TA 24 h', 20),
      ('Cardiologie', 'Holter EKG 24 h', 20),
      ('Gastroenterologie', 'Consultație gastroenterologie', 30),
      ('Gastroenterologie', 'Endoscopie digestivă superioară', 35),
      ('Gastroenterologie', 'Endoscopie digestivă inferioară', 50)
    ) as v(category_name, name, duration_minutes)
  loop
    select id into v_category_id from public.service_categories where clinic_id = cid and name = item.category_name;
    insert into public.services(
      organization_id, clinic_id, name, category_id, duration_minutes, duration_is_demo_default,
      price, buffer_before, buffer_after, instructions, required_documents, exclusion_rules, active, archived_at
    ) values (
      oid, cid, item.name, v_category_id, item.duration_minutes, true,
      null,
      case when item.name like 'Endoscopie %' or item.name = 'Infiltrație epidurală' then 10 else 0 end,
      case
        when item.name like '%substanță de contrast%' or item.name in ('Angiografie CT','Angiografie RMN','Colangio RMN abdomen') then 10
        when item.name like 'Endoscopie %' or item.name in ('Infiltrație epidurală','Ergometrie / test de efort') then 15
        when item.name like 'Holter %' or item.name like 'Pachet cardiologie:%' then 10
        else 5
      end,
      case
        when item.category_name in ('Computer tomograf', 'RMN') then 'Prezentați biletul de trimitere de la medicul specialist, dacă este necesar. Confirmați pregătirea specifică la recepție.'
        when item.category_name in ('Ecografie', 'Mamografie / ecografie mamară') then 'Prezentați biletul de trimitere de la medicul de familie, dacă este necesar. Confirmați pregătirea specifică la recepție.'
        else 'Confirmați la recepție pregătirea și documentele necesare.'
      end,
      case
        when item.category_name in ('Computer tomograf', 'RMN') then array['Carte/Buletin de identitate', 'Bilet de trimitere de la medic specialist, unde este necesar']
        when item.category_name in ('Ecografie', 'Mamografie / ecografie mamară') then array['Carte/Buletin de identitate', 'Bilet de trimitere de la medicul de familie, unde este necesar']
        else array['Carte/Buletin de identitate', 'Bilet de trimitere, unde este necesar']
      end,
      '{}'::text[], true, null
    )
    on conflict (clinic_id, name) do update set
      category_id = excluded.category_id,
      duration_minutes = excluded.duration_minutes,
      buffer_before = excluded.buffer_before,
      buffer_after = excluded.buffer_after,
      duration_is_demo_default = true,
      instructions = excluded.instructions,
      required_documents = excluded.required_documents,
      active = true,
      archived_at = null,
      updated_at = now();
  end loop;

  -- Service-to-room mappings are configuration records used by the scheduling engine.
  for item in select s.id as service_id, c.name as category_name, s.name as service_name
              from public.services s join public.service_categories c on c.id = s.category_id
              where s.clinic_id = cid
  loop
    for v_room_id in
      select r.id from public.rooms r where r.clinic_id = cid and (
        (item.category_name = 'RMN' and r.name = 'Cabinet RMN') or
        (item.category_name = 'Computer tomograf' and r.name = 'Cabinet CT') or
        (item.category_name = 'Mamografie / ecografie mamară' and r.name = 'Cabinet Mamografie') or
        (item.category_name = 'Ecografie' and r.name in ('Cabinet Ecografie 1', 'Cabinet Ecografie 2')) or
        (item.category_name = 'Cardiologie' and r.name = 'Cabinet Cardiologie') or
        (item.category_name = 'Neurochirurgie' and r.name = 'Cabinet Neurochirurgie') or
        (item.category_name = 'Gastroenterologie' and r.name = 'Cabinet Gastroenterologie')
      )
    loop
      insert into public.service_rooms(service_id, room_id, clinic_id)
      values (item.service_id, v_room_id, cid) on conflict do nothing;
    end loop;

    v_equipment_group := gen_random_uuid();
    for v_equipment_id in
      select e.id from public.equipment e where e.clinic_id = cid and (
        (item.category_name = 'RMN' and e.name = 'Aparat RMN') or
        (item.category_name = 'Computer tomograf' and e.name = 'Computer tomograf') or
        (item.category_name = 'Mamografie / ecografie mamară' and e.name = 'Mamograf digital') or
        (item.category_name = 'Ecografie' and e.name in ('Ecograf 1', 'Ecograf 2')) or
        (item.service_name = 'EKG' and e.name = 'EKG') or
        (item.service_name = 'Holter EKG 24 h' and e.name = 'Holter EKG') or
        (item.service_name = 'Holter TA 24 h' and e.name = 'Holter TA') or
        (item.service_name = 'Ergometrie / test de efort' and e.name = 'Echipament test de efort')
      )
    loop
      insert into public.service_equipment(service_id, equipment_id, clinic_id, quantity, requirement_group)
      values (item.service_id, v_equipment_id, cid, 1, v_equipment_group)
      on conflict (service_id, equipment_id) do update
        set requirement_group = excluded.requirement_group, quantity = excluded.quantity;
    end loop;
  end loop;

  -- Eligibility follows only the published specialty grouping supplied for this demo.
  for item in
    select dl.id as doctor_location_id, sp.name as speciality_name
    from public.doctor_locations dl
    join public.doctor_specialities ds on ds.doctor_location_id = dl.id
    join public.specialities sp on sp.id = ds.speciality_id
    where dl.clinic_id = cid and dl.active and dl.archived_at is null
  loop
    for v_service_id in
      select s.id
      from public.services s join public.service_categories c on c.id = s.category_id
      where s.clinic_id = cid and (
        (item.speciality_name = 'Radiodiagnostic și imagistică medicală' and c.name in ('Ecografie', 'Mamografie / ecografie mamară', 'Computer tomograf', 'RMN')) or
        (item.speciality_name = 'Cardiologie' and c.name = 'Cardiologie') or
        (item.speciality_name = 'Neurochirurgie' and c.name = 'Neurochirurgie') or
        (item.speciality_name = 'Gastroenterologie' and c.name = 'Gastroenterologie')
      )
    loop
      insert into public.doctor_services(doctor_location_id, service_id, clinic_id)
      values (item.doctor_location_id, v_service_id, cid) on conflict do nothing;
    end loop;

    for v_room_id in
      select r.id from public.rooms r where r.clinic_id = cid and (
        (item.speciality_name = 'Radiodiagnostic și imagistică medicală' and r.name in ('Cabinet RMN','Cabinet CT','Cabinet Mamografie','Cabinet Ecografie 1','Cabinet Ecografie 2')) or
        (item.speciality_name = 'Cardiologie' and r.name = 'Cabinet Cardiologie') or
        (item.speciality_name = 'Neurochirurgie' and r.name = 'Cabinet Neurochirurgie') or
        (item.speciality_name = 'Gastroenterologie' and r.name = 'Cabinet Gastroenterologie')
      )
    loop
      insert into public.doctor_rooms(doctor_location_id, room_id, clinic_id)
      values (item.doctor_location_id, v_room_id, cid) on conflict do nothing;
    end loop;
  end loop;

  -- The clinic schedule is the confirmed general schedule supplied for this installation.
  delete from public.availability_rules where clinic_id = cid and resource_kind = 'clinic';
  insert into public.availability_rules(
    organization_id, clinic_id, name, resource_kind, weekday,
    start_time, end_time, valid_from, interval_kind, active
  )
  select oid, cid, 'Program Clinica Maria — ' || day_name, 'clinic', weekday,
         time '08:00', time '20:00', date '2026-01-01', 'work', true
  from (values
    (1, 'Luni'), (2, 'Marți'), (3, 'Miercuri'), (4, 'Joi'), (5, 'Vineri')
  ) as days(weekday, day_name);
end $$;
