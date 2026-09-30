-- Phase 2. Clinical records are scoped to one location; practitioners have
-- organization identity with independent affiliations at each clinic.
insert into public.permissions(key,description) values
 ('patients.read','Registru pacienți'),('patients.manage','Administrare pacienți'),
 ('catalog.read','Nomenclatoare clinice'),('catalog.manage','Administrare nomenclatoare'),
 ('availability.read','Program de lucru'),('availability.manage','Configurare program');
insert into public.role_permissions select r.role,p.key from public.permissions p
 cross join (values('OWNER'::public.clinic_role),('ADMIN'::public.clinic_role)) r(role)
 where p.key like 'patients.%' or p.key like 'catalog.%' or p.key like 'availability.%';
insert into public.role_permissions values
 ('RECEPTION','patients.read'),('RECEPTION','patients.manage'),('RECEPTION','catalog.read'),('RECEPTION','availability.read'),
 ('DOCTOR','catalog.read'),('DOCTOR','availability.read'),('ASSISTANT','catalog.read'),('ASSISTANT','availability.read');

create table public.patients (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, clinic_id uuid not null,
 name text not null check(length(trim(name)) between 2 and 160), internal_id text not null check(length(trim(internal_id)) between 1 and 50),
 birth_date date check(birth_date between date '1900-01-01' and current_date), sex text not null default 'unspecified' check(sex in ('female','male','other','unspecified')),
 phone text not null default '' check(length(phone)<=40), email text not null default '' check(length(email)<=254),
 address text not null default '' check(length(address)<=500), city text not null default '' check(length(city)<=100),
 postal_code text not null default '' check(length(postal_code)<=20), country text not null default 'România' check(length(country)<=100),
 administrative_notes text not null default '' check(length(administrative_notes)<=5000),
 active boolean not null default true, archived_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(clinic_id,organization_id) references public.clinics(id,organization_id), unique(id,clinic_id), unique(clinic_id,internal_id)
);
create table public.specialities (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, clinic_id uuid not null,
 name text not null check(length(trim(name)) between 2 and 120), description text not null default '' check(length(description)<=2000),
 active boolean not null default true, archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(clinic_id,organization_id) references public.clinics(id,organization_id), unique(id,clinic_id), unique(clinic_id,name)
);
create table public.service_categories (like public.specialities including defaults including constraints including indexes);
alter table public.service_categories add foreign key(clinic_id,organization_id) references public.clinics(id,organization_id);
create table public.rooms (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, clinic_id uuid not null,
 name text not null check(length(trim(name)) between 2 and 120), type text not null default '' check(length(type)<=100), capacity integer not null default 1 check(capacity between 1 and 100),
 active boolean not null default true, archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(clinic_id,organization_id) references public.clinics(id,organization_id), unique(id,clinic_id), unique(clinic_id,name)
);
create table public.equipment (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, clinic_id uuid not null,
 name text not null check(length(trim(name)) between 2 and 120), type text not null default '' check(length(type)<=100),
 internal_id text not null check(length(trim(internal_id)) between 1 and 50), room_id uuid,
 capacity integer not null default 1 check(capacity between 1 and 100),
 active boolean not null default true, archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(clinic_id,organization_id) references public.clinics(id,organization_id), foreign key(room_id,clinic_id) references public.rooms(id,clinic_id),
 unique(id,clinic_id), unique(clinic_id,internal_id)
);
create table public.doctors (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 name text not null check(length(trim(name)) between 2 and 160), professional_code text not null check(length(trim(professional_code)) between 1 and 60),
 email text not null default '' check(length(email)<=254), phone text not null default '' check(length(phone)<=40),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,organization_id),unique(organization_id,professional_code)
);
create table public.doctor_locations (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, clinic_id uuid not null, doctor_id uuid not null,
 active boolean not null default true, archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(clinic_id,organization_id) references public.clinics(id,organization_id), foreign key(doctor_id,organization_id) references public.doctors(id,organization_id),
 unique(doctor_id,clinic_id),unique(id,clinic_id)
);
-- No storage objects or upload endpoints yet. References remain null in Phase 2.
create table public.doctor_credentials (
 doctor_location_id uuid primary key, clinic_id uuid not null, organization_id uuid not null,
 signature_object_path text check(signature_object_path is null), stamp_object_path text check(stamp_object_path is null),
 foreign key(doctor_location_id,clinic_id) references public.doctor_locations(id,clinic_id),
 foreign key(clinic_id,organization_id) references public.clinics(id,organization_id)
);
create table public.services (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, clinic_id uuid not null,
 name text not null check(length(trim(name)) between 2 and 160), category_id uuid,
 duration_minutes integer not null check(duration_minutes between 5 and 1440), price numeric(10,2) check(price between 0 and 99999999),
 buffer_before integer not null default 0 check(buffer_before between 0 and 240), buffer_after integer not null default 0 check(buffer_after between 0 and 240),
 instructions text not null default '' check(length(instructions)<=10000),
 required_documents text[] not null default '{}' check(cardinality(required_documents)<=50),
 exclusion_rules text[] not null default '{}' check(cardinality(exclusion_rules)<=50),
 active boolean not null default true, archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(clinic_id,organization_id) references public.clinics(id,organization_id), foreign key(category_id,clinic_id) references public.service_categories(id,clinic_id),
 unique(id,clinic_id), unique(clinic_id,name)
);
create table public.doctor_specialities (
 doctor_location_id uuid not null, speciality_id uuid not null, clinic_id uuid not null,
 primary key(doctor_location_id,speciality_id), foreign key(doctor_location_id,clinic_id) references public.doctor_locations(id,clinic_id),foreign key(speciality_id,clinic_id) references public.specialities(id,clinic_id)
);
create table public.doctor_rooms (
 doctor_location_id uuid not null, room_id uuid not null, clinic_id uuid not null,
 primary key(doctor_location_id,room_id),foreign key(doctor_location_id,clinic_id) references public.doctor_locations(id,clinic_id),foreign key(room_id,clinic_id) references public.rooms(id,clinic_id)
);
create table public.doctor_services (
 doctor_location_id uuid not null, service_id uuid not null, clinic_id uuid not null,
 primary key(doctor_location_id,service_id),foreign key(doctor_location_id,clinic_id) references public.doctor_locations(id,clinic_id),foreign key(service_id,clinic_id) references public.services(id,clinic_id)
);
create table public.service_rooms (
 service_id uuid not null, room_id uuid not null, clinic_id uuid not null,
 primary key(service_id,room_id),foreign key(service_id,clinic_id) references public.services(id,clinic_id),foreign key(room_id,clinic_id) references public.rooms(id,clinic_id)
);
create table public.service_equipment (
 service_id uuid not null, equipment_id uuid not null, clinic_id uuid not null, quantity integer not null default 1 check(quantity between 1 and 100),
 primary key(service_id,equipment_id),foreign key(service_id,clinic_id) references public.services(id,clinic_id),foreign key(equipment_id,clinic_id) references public.equipment(id,clinic_id)
);

-- Recurrence is wall-clock time in the clinic timezone. One row = one interval;
-- breaks may overlap work intervals and will be subtracted by Phase 3.
create table public.availability_rules (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,clinic_id uuid not null,
 name text not null check(length(trim(name)) between 2 and 160), resource_kind text not null check(resource_kind in ('clinic','doctor','room','equipment')),
 doctor_location_id uuid,room_id uuid,equipment_id uuid,
 weekday integer not null check(weekday between 1 and 7),start_time time not null,end_time time not null check(end_time>start_time),
 valid_from date not null,valid_until date check(valid_until>=valid_from),interval_kind text not null default 'work' check(interval_kind in ('work','break')),
 active boolean not null default true,archived_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(clinic_id,organization_id) references public.clinics(id,organization_id),
 foreign key(doctor_location_id,clinic_id) references public.doctor_locations(id,clinic_id),foreign key(room_id,clinic_id) references public.rooms(id,clinic_id),foreign key(equipment_id,clinic_id) references public.equipment(id,clinic_id),
 check((resource_kind='clinic' and num_nonnulls(doctor_location_id,room_id,equipment_id)=0) or
 (num_nonnulls(doctor_location_id,room_id,equipment_id)=1 and ((resource_kind='doctor' and doctor_location_id is not null) or (resource_kind='room' and room_id is not null) or (resource_kind='equipment' and equipment_id is not null))))
);
-- Extra work adds intervals to the weekly schedule; closed
-- exceptions and blocks subtract availability. All-day closure = local midnight
-- to next local midnight, represented by explicit-offset instants.
create table public.schedule_exceptions (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,clinic_id uuid not null,
 name text not null check(length(trim(name)) between 2 and 160),resource_kind text not null check(resource_kind in ('clinic','doctor','room','equipment')),
 doctor_location_id uuid,room_id uuid,equipment_id uuid,
 starts_at timestamptz not null,ends_at timestamptz not null check(ends_at>starts_at),
 exception_kind text not null check(exception_kind in ('extra_work','closed','holiday','leave','maintenance','meeting','manual')),
 notes text not null default '' check(length(notes)<=2000),active boolean not null default true,archived_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(clinic_id,organization_id) references public.clinics(id,organization_id),
 foreign key(doctor_location_id,clinic_id) references public.doctor_locations(id,clinic_id),foreign key(room_id,clinic_id) references public.rooms(id,clinic_id),foreign key(equipment_id,clinic_id) references public.equipment(id,clinic_id),
 check((resource_kind='clinic' and num_nonnulls(doctor_location_id,room_id,equipment_id)=0) or
 (num_nonnulls(doctor_location_id,room_id,equipment_id)=1 and ((resource_kind='doctor' and doctor_location_id is not null) or (resource_kind='room' and room_id is not null) or (resource_kind='equipment' and equipment_id is not null))))
);
create index availability_resource on public.availability_rules(clinic_id,resource_kind,weekday,valid_from);
create index exceptions_period on public.schedule_exceptions(clinic_id,starts_at,ends_at);
create index doctor_locations_identity on public.doctor_locations(doctor_id);
create index patients_search on public.patients(clinic_id,lower(name),id);
create index patients_phone on public.patients(clinic_id,phone);
create index patients_email on public.patients(clinic_id,lower(email));

create function private.audit_core() returns trigger language plpgsql security definer set search_path='' as $$
declare fields jsonb; begin
 select coalesce(jsonb_agg(k),'[]') into fields from jsonb_object_keys(to_jsonb(new)) k
 where k not in ('updated_at') and (tg_op='INSERT' or to_jsonb(new)->k is distinct from to_jsonb(old)->k);
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata)
 values(new.organization_id,new.clinic_id,auth.uid(),case when tg_op='UPDATE' and old.archived_at is null and new.archived_at is not null then 'archive' else lower(tg_op) end,tg_table_name,new.id,jsonb_build_object('fields',fields));
 return new; end $$;

do $$ declare t text; p text; begin
 foreach t in array array['patients','specialities','service_categories','rooms','equipment','doctor_locations','services','availability_rules','schedule_exceptions'] loop
 p=case when t='patients' then 'patients' when t in ('availability_rules','schedule_exceptions') then 'availability' else 'catalog' end;
 execute format('alter table public.%I enable row level security',t);
 execute format('create index on public.%I(clinic_id,archived_at,active)',t);
 execute format('create policy read_rows on public.%I for select to authenticated using(private.has_permission(clinic_id,%L))',t,p||'.read');
 execute format('create policy insert_rows on public.%I for insert to authenticated with check(private.has_permission(clinic_id,%L))',t,p||'.manage');
 execute format('create policy update_rows on public.%I for update to authenticated using(private.has_permission(clinic_id,%L)) with check(private.has_permission(clinic_id,%L))',t,p||'.manage',p||'.manage');
 execute format('create trigger touch before update on public.%I for each row execute function private.touch_updated_at()',t);
 execute format('create trigger audit after insert or update on public.%I for each row execute function private.audit_core()',t);
 execute format('grant select,insert,update on public.%I to authenticated',t);
 end loop;
 foreach t in array array['doctor_specialities','doctor_rooms','doctor_services','service_rooms','service_equipment','doctor_credentials'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create index on public.%I(clinic_id)',t);
 execute format('create policy read_rows on public.%I for select to authenticated using(private.has_permission(clinic_id,''catalog.read''))',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;

-- Identity fields cannot be retargeted even by a member of both tenants.
create function private.guard_core_identity() returns trigger language plpgsql set search_path='' as $$ begin
 if new.id<>old.id or new.clinic_id<>old.clinic_id or new.organization_id<>old.organization_id or new.created_at<>old.created_at then raise exception 'Immutable tenant identity'; end if;
 if tg_table_name='doctor_locations' and to_jsonb(new)->>'doctor_id'<>to_jsonb(old)->>'doctor_id' then raise exception 'Immutable doctor identity'; end if;
 return new; end $$;
do $$ declare t text; begin foreach t in array array['patients','specialities','service_categories','rooms','equipment','doctor_locations','services','availability_rules','schedule_exceptions'] loop
 execute format('create trigger identity_guard before update on public.%I for each row execute function private.guard_core_identity()',t); end loop; end $$;
alter table public.doctors enable row level security;
create policy doctors_read on public.doctors for select to authenticated using(exists(select 1 from public.doctor_locations l where l.doctor_id=doctors.id and private.has_permission(l.clinic_id,'catalog.read')));
grant select on public.doctors to authenticated;
create trigger touch before update on public.doctors for each row execute function private.touch_updated_at();
-- Affiliations can only be created by the checked workflow below.
revoke insert on public.doctor_locations from authenticated;
revoke all on function private.audit_core(),private.guard_core_identity() from public,anon,authenticated;
