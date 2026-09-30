create schema if not exists private;
revoke all on schema private from public;
create type public.clinic_role as enum ('OWNER','ADMIN','RECEPTION','DOCTOR','ASSISTANT');
create table public.organizations (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 2 and 100),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.clinics (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 name text not null check(length(name) between 2 and 100), address text not null default '' check(length(address)<=250),
 timezone text not null default 'Europe/Bucharest' check(timezone in ('Europe/Bucharest','Europe/London','Europe/Paris')),
 archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,organization_id), unique(organization_id,name)
);
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '' check(length(full_name)<=100), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.clinic_memberships (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
 organization_id uuid not null references public.organizations(id), clinic_id uuid not null,
 role public.clinic_role not null, active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(clinic_id,organization_id) references public.clinics(id,organization_id), unique(user_id,clinic_id)
);
create index memberships_user_active on public.clinic_memberships(user_id,clinic_id) where active;
create index memberships_clinic on public.clinic_memberships(clinic_id);
create index clinics_organization on public.clinics(organization_id);
create table public.permissions (key text primary key, description text not null);
create table public.role_permissions (role public.clinic_role not null, permission text not null references public.permissions(key), primary key(role,permission));
insert into public.permissions values ('clinic.read','Vizualizare locație'),('clinic.manage','Administrare locație'),('members.read','Vizualizare echipă'),('members.manage','Administrare acces'),('audit.read','Vizualizare audit'),('organization.manage','Administrare organizație');
insert into public.role_permissions select 'OWNER',key from public.permissions;
insert into public.role_permissions select 'ADMIN',key from public.permissions where key <> 'organization.manage';
insert into public.role_permissions values ('RECEPTION','clinic.read'),('DOCTOR','clinic.read'),('ASSISTANT','clinic.read');
create table public.user_preferences (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 default_clinic_id uuid references public.clinics(id), density text not null default 'compact' check(density in ('compact','comfortable')),
 locale text not null default 'ro' check(locale='ro'), updated_at timestamptz not null default now()
);
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 clinic_id uuid not null, actor_id uuid references public.profiles(id), action text not null,
 entity text not null, entity_id uuid not null, metadata jsonb not null default '{}', created_at timestamptz not null default now(),
 foreign key(clinic_id,organization_id) references public.clinics(id,organization_id)
);
create index audit_clinic_time on public.audit_logs(clinic_id,created_at desc);
create function private.touch_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end $$;
do $$ declare t text; begin foreach t in array array['organizations','clinics','profiles','clinic_memberships','user_preferences'] loop
 execute format('create trigger updated_at before update on public.%I for each row execute function private.touch_updated_at()',t); end loop; end $$;
create function private.create_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(id,full_name) values(new.id,left(coalesce(new.raw_user_meta_data->>'full_name',''),100)); return new; end $$;
create trigger auth_profile after insert on auth.users for each row execute function private.create_profile();
create function private.has_permission(cid uuid, p text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.clinic_memberships m join public.role_permissions r on r.role=m.role join public.clinics c on c.id=m.clinic_id
 where m.user_id=auth.uid() and m.clinic_id=cid and m.active and c.archived_at is null and r.permission=p)
$$;
create function private.org_owner(oid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.clinic_memberships m where m.user_id=auth.uid() and m.organization_id=oid and m.active and m.role='OWNER')
$$;
alter table public.organizations enable row level security;
alter table public.clinics enable row level security;
alter table public.profiles enable row level security;
alter table public.clinic_memberships enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_preferences enable row level security;
alter table public.audit_logs enable row level security;
create policy organization_read on public.organizations for select to authenticated using(exists(select 1 from public.clinic_memberships m where m.organization_id=organizations.id and m.user_id=auth.uid() and m.active));
create policy organization_update on public.organizations for update to authenticated using(private.org_owner(id)) with check(private.org_owner(id));
create policy clinic_read on public.clinics for select to authenticated using(private.has_permission(id,'clinic.read'));
create policy clinic_update on public.clinics for update to authenticated using(private.has_permission(id,'clinic.manage')) with check(private.has_permission(id,'clinic.manage'));
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid() or exists(select 1 from public.clinic_memberships m where m.user_id=profiles.id and private.has_permission(m.clinic_id,'members.read')));
create policy profile_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy membership_read on public.clinic_memberships for select to authenticated using((user_id=auth.uid() and active) or private.has_permission(clinic_id,'members.read'));
create policy permission_read on public.permissions for select to authenticated using(true);
create policy role_permission_read on public.role_permissions for select to authenticated using(true);
create policy preferences_read on public.user_preferences for select to authenticated using(user_id=auth.uid());
create policy preferences_insert on public.user_preferences for insert to authenticated with check(user_id=auth.uid() and (default_clinic_id is null or private.has_permission(default_clinic_id,'clinic.read')));
create policy preferences_update on public.user_preferences for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and (default_clinic_id is null or private.has_permission(default_clinic_id,'clinic.read')));
create policy audit_read on public.audit_logs for select to authenticated using(private.has_permission(clinic_id,'audit.read'));
revoke all on all tables in schema public from anon,authenticated;
grant select on public.organizations,public.clinics,public.profiles,public.clinic_memberships,public.permissions,public.role_permissions,public.user_preferences,public.audit_logs to authenticated;
grant update(name) on public.organizations to authenticated;
grant update(name,address,timezone) on public.clinics to authenticated;
grant update(full_name) on public.profiles to authenticated;
grant insert(user_id,default_clinic_id,density),update(default_clinic_id,density) on public.user_preferences to authenticated;
grant usage on schema private to authenticated;
grant execute on function private.has_permission(uuid,text),private.org_owner(uuid) to authenticated;

-- Mutation audit contains identifiers and changed field names, never full rows or PII.
create function private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare cid uuid; oid uuid; fields jsonb; begin
 if tg_table_name='clinics' then cid=new.id; oid=new.organization_id;
 elsif tg_table_name='clinic_memberships' then cid=new.clinic_id; oid=new.organization_id;
 else return new; end if;
 select coalesce(jsonb_agg(k),'[]') into fields from jsonb_object_keys(to_jsonb(new)) k where tg_op='INSERT' or (to_jsonb(new)->k is distinct from to_jsonb(old)->k);
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata) values(oid,cid,auth.uid(),lower(tg_op),tg_table_name,new.id,jsonb_build_object('fields',fields));
 return new; end $$;
create trigger clinic_audit after insert or update on public.clinics for each row execute function private.audit_change();
create trigger membership_audit after insert or update on public.clinic_memberships for each row execute function private.audit_change();
