-- Forward-only SaaS lifecycle. Existing clinic/location identifiers remain intact.
alter table public.organizations
 add column legal_name text not null default '' check(length(legal_name)<=160),
 add column cui text not null default '' check(length(cui)<=30),
 add column email text not null default '' check(length(email)<=254),
 add column phone text not null default '' check(length(phone)<=40),
 add column website text not null default '' check(length(website)<=500),
 add column logo_path text,
 add column specialty text not null default '' check(length(specialty)<=120),
 add column timezone text not null default 'Europe/Bucharest' check(timezone in ('Europe/Bucharest','Europe/London','Europe/Paris')),
 add column currency text not null default 'RON' check(currency in ('RON','EUR','GBP')),
 add column country text not null default 'RO',
 add column onboarding_completed boolean not null default true,
 add column plan text not null default 'trial',
 add column subscription_status text not null default 'trialing' check(subscription_status in ('trialing','active','past_due','cancelled')),
 add column trial_started_at timestamptz not null default now(),
 add column trial_ends_at timestamptz not null default (now()+interval '30 days');
alter table public.organizations alter column onboarding_completed set default false;
alter table public.clinics add column city text not null default '' check(length(city)<=100),
 add column county text not null default '' check(length(county)<=100),
 add column postal_code text not null default '' check(length(postal_code)<=20);
grant update(city,county,postal_code) on public.clinics to authenticated;
alter table public.doctors add column calendar_color text not null default '#397766' check(calendar_color ~ '^#[a-fA-F0-9]{6}$');

-- Organization membership is the active projection of explicitly assigned
-- location memberships. Editing the projection directly is never granted.
create table public.organization_members (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 user_id uuid not null references public.profiles(id), role public.clinic_role not null,
 status text not null check(status in ('active','suspended')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,user_id)
);
create index organization_members_user on public.organization_members(user_id,status,organization_id);
insert into public.organization_members(organization_id,user_id,role,status)
 select organization_id,user_id,
 (array_agg(role order by active desc,case role when 'OWNER' then 0 when 'ADMIN' then 1 when 'RECEPTION' then 2 when 'DOCTOR' then 3 else 4 end))[1],
 case when bool_or(active) then 'active' else 'suspended' end
 from public.clinic_memberships group by organization_id,user_id;
create function private.sync_organization_membership() returns trigger language plpgsql security definer set search_path='' as $$
declare oid uuid; uid uuid; selected_role public.clinic_role; enabled boolean;
begin
 oid=coalesce(new.organization_id,old.organization_id); uid=coalesce(new.user_id,old.user_id);
 -- Serialize aggregation before selecting roles. Otherwise two concurrent
 -- location revocations can project each other's uncommitted old grant.
 perform 1 from public.organizations where id=oid for update;
 select (array_agg(role order by active desc,case role when 'OWNER' then 0 when 'ADMIN' then 1 when 'RECEPTION' then 2 when 'DOCTOR' then 3 else 4 end))[1],bool_or(active)
 into selected_role,enabled from public.clinic_memberships where organization_id=oid and user_id=uid;
 if selected_role is null then update public.organization_members set status='suspended',updated_at=now() where organization_id=oid and user_id=uid;
 else insert into public.organization_members(organization_id,user_id,role,status) values(oid,uid,selected_role,case when enabled then 'active' else 'suspended' end)
 on conflict(organization_id,user_id) do update set role=excluded.role,status=excluded.status,updated_at=now(); end if;
 return coalesce(new,old);
end $$;
create trigger organization_membership_sync after insert or update or delete on public.clinic_memberships for each row execute function private.sync_organization_membership();
create function private.org_member(oid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organization_members where organization_id=oid and user_id=auth.uid() and status='active')
$$;
create or replace function private.org_owner(oid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organization_members where organization_id=oid and user_id=auth.uid() and role='OWNER' and status='active')
$$;
alter table public.organization_members enable row level security;
create policy member_read on public.organization_members for select to authenticated using(user_id=auth.uid() or private.org_owner(organization_id));
grant select on public.organization_members to authenticated;
drop policy organization_read on public.organizations;
create policy organization_read on public.organizations for select to authenticated using(private.org_member(id));

create table public.organization_settings (
 organization_id uuid primary key references public.organizations(id),
 appointment_settings jsonb not null default '{}', notification_settings jsonb not null default '{}',
 branding_settings jsonb not null default '{}', calendar_settings jsonb not null default '{}',
 privacy_settings jsonb not null default '{"retention_review_required":true}', updated_at timestamptz not null default now(),
 check(jsonb_typeof(appointment_settings)='object' and jsonb_typeof(notification_settings)='object'
 and jsonb_typeof(branding_settings)='object' and jsonb_typeof(calendar_settings)='object' and jsonb_typeof(privacy_settings)='object'),
 check(octet_length(appointment_settings::text)+octet_length(notification_settings::text)+octet_length(branding_settings::text)+octet_length(calendar_settings::text)+octet_length(privacy_settings::text)<=65536)
);
insert into public.organization_settings(organization_id) select id from public.organizations;
alter table public.organization_settings enable row level security;
create policy settings_read on public.organization_settings for select to authenticated using(private.org_owner(organization_id));
create policy settings_update on public.organization_settings for update to authenticated using(private.org_owner(organization_id)) with check(private.org_owner(organization_id));
grant select on public.organization_settings to authenticated;
grant update(appointment_settings,notification_settings,branding_settings,calendar_settings,privacy_settings) on public.organization_settings to authenticated;
create trigger settings_touch before update on public.organization_settings for each row execute function private.touch_updated_at();
create function private.audit_org_settings() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id,metadata)
 select new.organization_id,id,auth.uid(),'update','organization_settings',new.organization_id,'{"fields":["settings"]}'::jsonb
 from public.clinics where organization_id=new.organization_id and archived_at is null;
 return new;
end $$;
create trigger settings_audit after update on public.organization_settings for each row execute function private.audit_org_settings();

create table public.onboarding_drafts (
 organization_id uuid primary key references public.organizations(id),
 step integer not null default 1 check(step between 1 and 8),
 payload jsonb not null default '{}' check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=262144),
 revision integer not null default 0, updated_at timestamptz not null default now()
);
alter table public.onboarding_drafts enable row level security;
create policy draft_read on public.onboarding_drafts for select to authenticated using(private.org_owner(organization_id));
grant select on public.onboarding_drafts to authenticated;

create or replace function public.create_organization(org_name text,clinic_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare oid uuid; cid uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if exists(select 1 from public.clinic_memberships where user_id=auth.uid()) then raise exception 'Organization already assigned'; end if;
 insert into public.organizations(name,onboarding_completed) values(trim(org_name),false) returning id into oid;
 insert into public.clinics(organization_id,name) values(oid,trim(clinic_name)) returning id into cid;
 insert into public.clinic_memberships(user_id,organization_id,clinic_id,role) values(auth.uid(),oid,cid,'OWNER');
 insert into public.organization_settings(organization_id) values(oid);
 insert into public.onboarding_drafts(organization_id) values(oid);
 insert into public.user_preferences(user_id,default_clinic_id) values(auth.uid(),cid)
 on conflict(user_id) do update set default_clinic_id=cid;
 return cid;
end $$;
create function public.save_onboarding(oid uuid,draft jsonb,next_step integer,expected_revision integer) returns integer language plpgsql security definer set search_path='' as $$
declare next_revision integer;
begin
 if not private.org_owner(oid) then raise exception 'Access denied' using errcode='42501'; end if;
 perform 1 from public.organizations where id=oid and not onboarding_completed for update;
 if not found then raise exception 'Setup already completed'; end if;
 update public.onboarding_drafts set payload=draft,step=next_step,revision=revision+1,updated_at=now()
 where organization_id=oid and revision=expected_revision returning revision into next_revision;
 if next_revision is null then raise exception 'Stale version' using errcode='40001'; end if;
 return next_revision;
end $$;

create table public.organization_invites (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, clinic_id uuid not null,
 email text not null check(email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' and length(email)<=254),
 role public.clinic_role not null check(role not in ('OWNER','ASSISTANT')),
 token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz not null default now()+interval '7 days', accepted_at timestamptz,
 revoked_at timestamptz, invited_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 foreign key(clinic_id,organization_id) references public.clinics(id,organization_id)
);
create index invites_clinic on public.organization_invites(clinic_id,created_at desc);
alter table public.organization_invites enable row level security;
create policy invites_read on public.organization_invites for select to authenticated using(private.has_permission(clinic_id,'members.manage'));
-- Bearer digest is omitted even from staff SELECT privileges.
grant select(id,organization_id,clinic_id,email,role,expires_at,accepted_at,revoked_at,invited_by,created_at) on public.organization_invites to authenticated;
create function public.create_staff_invite(cid uuid,target_email text,target_role public.clinic_role,digest text) returns uuid language plpgsql security definer set search_path='' as $$
declare oid uuid; iid uuid;
begin
 if not private.has_permission(cid,'members.manage') then raise exception 'Access denied' using errcode='42501'; end if;
 select organization_id into oid from public.clinics where id=cid;
 perform pg_advisory_xact_lock(hashtextextended(cid::text,23));
 if (select count(*) from public.organization_invites where invited_by=auth.uid() and created_at>now()-interval '1 hour')>=30 then raise exception 'Too many invitations'; end if;
 update public.organization_invites set revoked_at=now() where clinic_id=cid and email=lower(trim(target_email)) and accepted_at is null and revoked_at is null;
 insert into public.organization_invites(organization_id,clinic_id,email,role,token_hash,invited_by)
 values(oid,cid,lower(trim(target_email)),target_role,digest,auth.uid()) returning id into iid;
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id) values(oid,cid,auth.uid(),'invite','organization_invites',iid);
 return iid;
end $$;
create function public.revoke_staff_invite(iid uuid) returns void language plpgsql security definer set search_path='' as $$
declare invitation public.organization_invites;
begin
 select * into invitation from public.organization_invites where id=iid for update;
 if not private.has_permission(invitation.clinic_id,'members.manage') then raise exception 'Access denied' using errcode='42501'; end if;
 update public.organization_invites set revoked_at=now() where id=iid and accepted_at is null;
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id) values(invitation.organization_id,invitation.clinic_id,auth.uid(),'revoke','organization_invites',iid);
end $$;
create function public.accept_staff_invite(digest text) returns uuid language plpgsql security definer set search_path='' as $$
declare invitation public.organization_invites; verified_email text; cid uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select lower(email) into verified_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 -- Use the same lock order as creation/revocation to avoid an invitation-row
 -- versus location-lock deadlock when a link is replaced during acceptance.
 select clinic_id into cid from public.organization_invites where token_hash=digest;
 if cid is null then raise exception 'Invitation unavailable' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(cid::text,23));
 select * into invitation from public.organization_invites where token_hash=digest for update;
 if invitation.id is null or invitation.email is distinct from verified_email or invitation.expires_at<=now() or invitation.revoked_at is not null or invitation.accepted_at is not null
 then raise exception 'Invitation unavailable' using errcode='42501'; end if;
 cid=invitation.clinic_id;
 if not private.has_permission_for_user(invitation.invited_by,cid,'members.manage') then raise exception 'Invitation unavailable' using errcode='42501'; end if;
 if exists(select 1 from public.clinic_memberships where user_id=auth.uid() and clinic_id=cid) then raise exception 'Membership already exists'; end if;
 insert into public.clinic_memberships(user_id,organization_id,clinic_id,role) values(auth.uid(),invitation.organization_id,cid,invitation.role);
 update public.organization_invites set accepted_at=now() where id=invitation.id;
 insert into public.audit_logs(organization_id,clinic_id,actor_id,action,entity,entity_id) values(invitation.organization_id,cid,auth.uid(),'accept','organization_invites',invitation.id);
 return cid;
end $$;
create function private.has_permission_for_user(uid uuid,cid uuid,p text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.clinic_memberships m join public.role_permissions r on r.role=m.role join public.clinics c on c.id=m.clinic_id
 where m.user_id=uid and m.clinic_id=cid and m.active and c.archived_at is null and r.permission=p)
$$;

-- Database guard complements set_membership's locks/self-change rules.
create function private.guard_last_owner() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.active and old.role='OWNER' and (tg_op='DELETE' or not new.active or new.role<>'OWNER') then
  perform 1 from public.organizations where id=old.organization_id for update;
  if not exists(select 1 from public.clinic_memberships where organization_id=old.organization_id and id<>old.id and active and role='OWNER') then raise exception 'Last organization owner'; end if;
 end if;
 return coalesce(new,old);
end $$;
create trigger last_owner_guard before update or delete on public.clinic_memberships for each row execute function private.guard_last_owner();

revoke all on function private.sync_organization_membership(),private.org_member(uuid),private.has_permission_for_user(uuid,uuid,text),private.guard_last_owner(),private.audit_org_settings() from public,anon,authenticated;
grant execute on function private.org_member(uuid) to authenticated;
revoke all on function public.save_onboarding(uuid,jsonb,integer,integer),public.create_staff_invite(uuid,text,public.clinic_role,text),public.revoke_staff_invite(uuid),public.accept_staff_invite(text) from public,anon;
grant execute on function public.save_onboarding(uuid,jsonb,integer,integer),public.create_staff_invite(uuid,text,public.clinic_role,text),public.revoke_staff_invite(uuid),public.accept_staff_invite(text) to authenticated;
