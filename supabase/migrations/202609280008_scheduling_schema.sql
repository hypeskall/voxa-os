-- Phase 3 scheduling data. Mutations are exposed only through the transactional
-- workflows in the next migration; authenticated clients receive read access only.
create type public.appointment_status as enum (
 'PENDING','CONFIRMED','ARRIVED','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW'
);
create type public.appointment_source as enum (
 'RECEPTION','WEBSITE','PATIENT_PORTAL','API','VOICE_AGENT'
);

insert into public.permissions(key,description) values
 ('appointments.read','Vizualizare programări'),
 ('appointments.manage','Creare și administrare programări'),
 ('appointments.override','Confirmare avertismente de programare');
insert into public.role_permissions select r.role,p.key from public.permissions p
 cross join (values('OWNER'::public.clinic_role),('ADMIN'::public.clinic_role)) r(role)
 where p.key like 'appointments.%';
insert into public.role_permissions values
 ('RECEPTION','appointments.read'),('RECEPTION','appointments.manage');

alter table public.services
 add column doctor_requirement text not null default 'required'
  check(doctor_requirement in ('required','optional','none')),
 add column room_required boolean not null default true,
 add column minimum_room_capacity integer not null default 1
  check(minimum_room_capacity between 1 and 100);

-- Rows sharing a requirement_group are alternatives. Existing Phase 2 rows each
-- receive a distinct group and therefore remain individually required.
alter table public.service_equipment
 add column requirement_group uuid not null default gen_random_uuid(),
 add column minimum_capacity integer not null default 1
  check(minimum_capacity between 1 and 100);
create index service_equipment_requirements
 on public.service_equipment(clinic_id,service_id,requirement_group);

create table public.appointments (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 clinic_id uuid not null,
 patient_id uuid not null,
 service_id uuid not null,
 doctor_location_id uuid,
 start_at timestamptz not null,
 end_at timestamptz not null,
 occupied_start_at timestamptz not null,
 occupied_end_at timestamptz not null,
 duration_minutes integer not null check(duration_minutes between 5 and 1440),
 buffer_before integer not null check(buffer_before between 0 and 240),
 buffer_after integer not null check(buffer_after between 0 and 240),
 status public.appointment_status not null default 'PENDING',
 source public.appointment_source not null default 'RECEPTION',
 notes text not null default '' check(length(notes)<=5000),
 cancellation_reason text not null default '' check(length(cancellation_reason)<=1000),
 created_by uuid not null references public.profiles(id),
 cancelled_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(clinic_id,organization_id) references public.clinics(id,organization_id),
 foreign key(patient_id,clinic_id) references public.patients(id,clinic_id),
 foreign key(service_id,clinic_id) references public.services(id,clinic_id),
 foreign key(doctor_location_id,clinic_id) references public.doctor_locations(id,clinic_id),
 unique(id,clinic_id),
 check(end_at>start_at),
 check(occupied_start_at<=start_at and occupied_end_at>=end_at),
 check((status='CANCELLED')=(cancelled_at is not null))
);

create table public.appointment_resources (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 clinic_id uuid not null,
 appointment_id uuid not null,
 resource_kind text not null check(resource_kind in ('room','equipment')),
 room_id uuid,
 equipment_id uuid,
 capacity_units integer not null default 1 check(capacity_units between 1 and 100),
 requirement_group uuid,
 created_at timestamptz not null default now(),
 foreign key(clinic_id,organization_id) references public.clinics(id,organization_id),
 foreign key(appointment_id,clinic_id) references public.appointments(id,clinic_id) on delete restrict,
 foreign key(room_id,clinic_id) references public.rooms(id,clinic_id),
 foreign key(equipment_id,clinic_id) references public.equipment(id,clinic_id),
 check((resource_kind='room' and room_id is not null and equipment_id is null)
    or (resource_kind='equipment' and equipment_id is not null and room_id is null)),
 unique(appointment_id,resource_kind,room_id,equipment_id)
);

create table public.appointment_history (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 clinic_id uuid not null,
 appointment_id uuid not null,
 event text not null check(event in (
  'CREATED','RESCHEDULED','CANCELLED','STATUS_CHANGED',
  'RESOURCES_ASSIGNED','DUPLICATE_OVERRIDE'
 )),
 actor_id uuid not null references public.profiles(id),
 old_values jsonb not null default '{}',
 new_values jsonb not null default '{}',
 reason text not null default '' check(length(reason)<=1000),
 created_at timestamptz not null default now(),
 foreign key(clinic_id,organization_id) references public.clinics(id,organization_id),
 foreign key(appointment_id,clinic_id) references public.appointments(id,clinic_id) on delete restrict
);

create index appointments_clinic_start
 on public.appointments(clinic_id,start_at,id);
create index appointments_patient_time
 on public.appointments(clinic_id,patient_id,start_at desc);
create index appointments_status_time
 on public.appointments(clinic_id,status,start_at);
create index appointments_service_time
 on public.appointments(clinic_id,service_id,start_at);
create index appointments_doctor_occupied
 on public.appointments(clinic_id,doctor_location_id,occupied_start_at,occupied_end_at)
 where status<>'CANCELLED' and doctor_location_id is not null;
create index appointment_resources_room
 on public.appointment_resources(clinic_id,room_id,appointment_id)
 where room_id is not null;
create index appointment_resources_equipment
 on public.appointment_resources(clinic_id,equipment_id,appointment_id)
 where equipment_id is not null;
create index appointment_history_timeline
 on public.appointment_history(clinic_id,appointment_id,created_at desc);

alter table public.appointments enable row level security;
alter table public.appointment_resources enable row level security;
alter table public.appointment_history enable row level security;
create policy appointments_read on public.appointments for select to authenticated
 using(private.has_permission(clinic_id,'appointments.read'));
create policy appointment_resources_read on public.appointment_resources for select to authenticated
 using(private.has_permission(clinic_id,'appointments.read'));
create policy appointment_history_read on public.appointment_history for select to authenticated
 using(private.has_permission(clinic_id,'appointments.read'));
grant select on public.appointments,public.appointment_resources,public.appointment_history to authenticated;

create trigger appointments_touch before update on public.appointments
 for each row execute function private.touch_updated_at();

create function private.guard_appointment_identity() returns trigger
language plpgsql set search_path='' as $$ begin
 if new.id<>old.id or new.organization_id<>old.organization_id
    or new.clinic_id<>old.clinic_id or new.patient_id<>old.patient_id
    or new.service_id<>old.service_id or new.created_by<>old.created_by
    or new.created_at<>old.created_at then
  raise exception 'Immutable appointment identity';
 end if;
 return new;
end $$;
create trigger appointment_identity before update on public.appointments
 for each row execute function private.guard_appointment_identity();

revoke all on function private.guard_appointment_identity() from public,anon,authenticated;
