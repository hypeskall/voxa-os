-- Organization entitlements are authoritative here, independent of browser state.
-- Keep legacy trial dates for compatibility; never restart an existing trial.
create table public.license_keys (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid references public.organizations(id),
 code_hash text not null unique check(code_hash ~ '^[a-f0-9]{64}$'),
 code_hint text not null check(length(code_hint)=4),
 status text not null default 'available' check(status in ('available','assigned','active','expired','revoked')),
 plan text not null default 'voxa_os_monthly' check(plan='voxa_os_monthly'),
 duration_months integer not null default 1 check(duration_months between 1 and 12),
 redeem_by timestamptz not null,
 expires_at timestamptz,
 activated_at timestamptz,
 created_by uuid references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(status not in ('assigned','active') or organization_id is not null),
 check(status <> 'active' or (activated_at is not null and expires_at is not null))
);
create table public.organization_subscriptions (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null unique references public.organizations(id),
 plan text not null default 'voxa_os_monthly' check(plan='voxa_os_monthly'),
 status text not null default 'trialing' check(status in ('trialing','active','past_due','canceled','expired','inactive')),
 billing_cycle text not null default 'monthly' check(billing_cycle='monthly'),
 trial_started_at timestamptz not null,
 trial_ends_at timestamptz not null,
 current_period_start timestamptz,
 current_period_end timestamptz,
 cancel_at_period_end boolean not null default false,
 ended_at timestamptz,
 license_key_id uuid references public.license_keys(id),
 -- A future verified provider adapter must set a bounded period and reference.
 entitlement_source text check(entitlement_source in ('license','provider')),
 provider_reference text unique,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(trial_ends_at > trial_started_at),
 check(current_period_end is null or current_period_end > current_period_start),
 check(status <> 'active' or (current_period_start is not null and current_period_end is not null and entitlement_source is not null)),
 check(entitlement_source is distinct from 'license' or license_key_id is not null),
 check(entitlement_source is distinct from 'provider' or provider_reference is not null)
);
create table public.subscription_events (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 subscription_id uuid not null references public.organization_subscriptions(id),
 event_type text not null,
 metadata jsonb not null default '{}' check(jsonb_typeof(metadata)='object'),
 created_at timestamptz not null default now()
);
create index subscription_events_org on public.subscription_events(organization_id,created_at desc);
create table private.license_activation_attempts (
 organization_id uuid primary key references public.organizations(id),
 window_started_at timestamptz not null, attempts integer not null
);

insert into public.organization_subscriptions(organization_id,trial_started_at,trial_ends_at,status)
 select id,trial_started_at,trial_ends_at,
 case when trial_ends_at>now() then 'trialing' else 'expired' end
 from public.organizations;
-- Legacy status='active' without a verified bounded entitlement is not payment proof.
insert into public.subscription_events(organization_id,subscription_id,event_type,metadata)
 select organization_id,id,'trial_started',jsonb_build_object('backfilled',true,'trial_ends_at',trial_ends_at)
 from public.organization_subscriptions;
insert into public.subscription_events(organization_id,subscription_id,event_type)
 select organization_id,id,'trial_expired' from public.organization_subscriptions where status='expired';

create function private.start_organization_trial() returns trigger language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 -- New organizations always receive exactly 30 days, irrespective of supplied fields.
 update public.organizations set trial_started_at=now(),trial_ends_at=now()+interval '30 days' where id=new.id;
 insert into public.organization_subscriptions(organization_id,trial_started_at,trial_ends_at)
 values(new.id,now(),now()+interval '30 days') returning id into sid;
 insert into public.subscription_events(organization_id,subscription_id,event_type) values(new.id,sid,'trial_started');
 return new;
end $$;
create trigger organization_trial after insert on public.organizations for each row execute function private.start_organization_trial();
create trigger subscription_touch before update on public.organization_subscriptions for each row execute function private.touch_updated_at();
create trigger license_touch before update on public.license_keys for each row execute function private.touch_updated_at();

-- Billing authorization stays available after expiry. Tenant owners cannot mint licenses.
create function private.billing_owner(oid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organization_members where organization_id=oid and user_id=auth.uid() and role='OWNER' and status='active')
$$;
create function private.organization_entitled(oid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organization_subscriptions s where s.organization_id=oid and (
 (s.status='trialing' and s.trial_started_at<=now() and s.trial_ends_at>now()) or
 (s.status='active' and s.current_period_start<=now() and s.current_period_end>now() and (
 (s.entitlement_source='provider' and s.provider_reference is not null) or
 (s.entitlement_source='license' and exists(select 1 from public.license_keys l where l.id=s.license_key_id
 and l.organization_id=oid and l.status='active' and l.activated_at<=now() and l.expires_at>now()))))))
$$;
create function private.clinic_entitled(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select private.organization_entitled(organization_id) from public.clinics where id=cid),false)
$$;
create or replace function private.has_permission(cid uuid,p text) returns boolean language sql stable security definer set search_path='' as $$
 select private.clinic_entitled(cid) and exists(select 1 from public.clinic_memberships m join public.role_permissions r on r.role=m.role join public.clinics c on c.id=m.clinic_id
 where m.user_id=auth.uid() and m.clinic_id=cid and m.active and c.archived_at is null and r.permission=p)
$$;
create or replace function private.org_owner(oid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.billing_owner(oid) and private.organization_entitled(oid)
$$;
create or replace function private.has_permission_for_user(uid uuid,cid uuid,p text) returns boolean language sql stable security definer set search_path='' as $$
 select private.clinic_entitled(cid) and exists(select 1 from public.clinic_memberships m join public.role_permissions r on r.role=m.role join public.clinics c on c.id=m.clinic_id
 where m.user_id=uid and m.clinic_id=cid and m.active and c.archived_at is null and r.permission=p)
$$;
create or replace function private.is_patient_for(cid uuid,pid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.clinic_entitled(cid) and exists(select 1 from public.patient_identities i where i.user_id=auth.uid() and i.clinic_id=cid and i.patient_id=pid and i.revoked_at is null)
$$;
create or replace function public.my_permissions(cid uuid) returns setof text language sql stable security definer set search_path='' as $$
 select r.permission from public.clinic_memberships m join public.role_permissions r on r.role=m.role join public.clinics c on c.id=m.clinic_id
 where m.user_id=auth.uid() and m.clinic_id=cid and m.active and c.archived_at is null and private.clinic_entitled(cid)
$$;
-- Only clinic metadata remains visible so expired tenants can be routed to billing.
drop policy clinic_read on public.clinics;
create policy clinic_read on public.clinics for select to authenticated using(archived_at is null and exists(
 select 1 from public.clinic_memberships m where m.clinic_id=clinics.id and m.user_id=auth.uid() and m.active));
-- Restrictive policies supplement existing tenant/role policies, never replace them.
do $$ declare t record; begin
 for t in select c.table_name from information_schema.columns c join pg_class p on p.relname=c.table_name
 join pg_namespace n on n.oid=p.relnamespace and n.nspname='public'
 where c.table_schema='public' and c.column_name='organization_id' and p.relrowsecurity
 and c.table_name not in ('clinics','clinic_memberships','organization_members','organization_subscriptions','license_keys','subscription_events') loop
 execute format('create policy subscription_required on public.%I as restrictive for all to authenticated using(private.organization_entitled(organization_id)) with check(private.organization_entitled(organization_id))',t.table_name);
 end loop;
end $$;
alter table public.organization_subscriptions enable row level security;
alter table public.license_keys enable row level security;
alter table public.subscription_events enable row level security;
create policy subscription_owner_read on public.organization_subscriptions for select to authenticated using(private.billing_owner(organization_id));
create policy license_owner_read on public.license_keys for select to authenticated using(private.billing_owner(organization_id));
create policy events_owner_read on public.subscription_events for select to authenticated using(private.billing_owner(organization_id));
revoke all on public.organization_subscriptions,public.license_keys,public.subscription_events from public,anon,authenticated;
grant select on public.organization_subscriptions,public.subscription_events to authenticated;
-- Never expose even license hashes through the tenant API.
grant select(id,organization_id,code_hint,status,plan,expires_at,activated_at,created_at,updated_at) on public.license_keys to authenticated;

create function private.refresh_subscription(oid uuid) returns void language plpgsql security definer set search_path='' as $$
declare s public.organization_subscriptions;
begin
 select * into s from public.organization_subscriptions where organization_id=oid for update;
 if (s.status='trialing' and s.trial_ends_at<=now()) or (s.status='active' and not private.organization_entitled(oid)) then
 update public.organization_subscriptions set status=case when cancel_at_period_end then 'canceled' else 'expired' end,ended_at=now() where id=s.id;
 insert into public.subscription_events(organization_id,subscription_id,event_type)
 values(oid,s.id,case when s.status='trialing' then 'trial_expired' when s.cancel_at_period_end then 'subscription_canceled' else 'subscription_expired' end);
 end if;
 update public.license_keys set status='expired' where organization_id=oid and status='active' and expires_at<=now();
end $$;
create function public.organization_access(oid uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not private.org_member(oid) then raise exception 'Access denied' using errcode='42501'; end if;
 perform private.refresh_subscription(oid);
 return private.organization_entitled(oid);
end $$;

-- The service-role-only issuer receives a SHA-256 hash of 128 cryptographically
-- random bits. Plaintext exists only in the operator's one-time output.
create function public.issue_license(digest text,hint text,assigned_org uuid default null,months integer default 1,redeem_deadline timestamptz default now()+interval '30 days')
 returns uuid language plpgsql security definer set search_path='' as $$
declare lid uuid; sid uuid;
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' then raise exception 'Internal access required' using errcode='42501'; end if;
 if digest !~ '^[a-f0-9]{64}$' or hint !~ '^[A-F0-9]{4}$' or months not between 1 and 12 or redeem_deadline<=now() or redeem_deadline>now()+interval '1 year' then raise exception 'Invalid license'; end if;
 insert into public.license_keys(code_hash,code_hint,organization_id,status,duration_months,redeem_by)
 values(digest,hint,assigned_org,case when assigned_org is null then 'available' else 'assigned' end,months,redeem_deadline) returning id into lid;
 if assigned_org is not null then
 select id into sid from public.organization_subscriptions where organization_id=assigned_org;
 insert into public.subscription_events(organization_id,subscription_id,event_type,metadata) values(assigned_org,sid,'license_assigned',jsonb_build_object('license_id',lid));
 end if;
 return lid;
end $$;
create function public.activate_license(oid uuid,digest text) returns boolean language plpgsql security definer set search_path='' as $$
declare l public.license_keys; s public.organization_subscriptions; until_at timestamptz; count_attempts integer;
begin
 if not private.billing_owner(oid) then raise exception 'Access denied' using errcode='42501'; end if;
 -- Serialize per subscription first, then per license: concurrent redemptions cannot reuse it.
 select * into s from public.organization_subscriptions where organization_id=oid for update;
 if not found then return false; end if;
 insert into private.license_activation_attempts values(oid,now(),1)
 on conflict(organization_id) do update set
 attempts=case when private.license_activation_attempts.window_started_at<now()-interval '15 minutes' then 1 else private.license_activation_attempts.attempts+1 end,
 window_started_at=case when private.license_activation_attempts.window_started_at<now()-interval '15 minutes' then now() else private.license_activation_attempts.window_started_at end
 returning attempts into count_attempts;
 -- Return false (not an exception) so invalid attempts persist in the transaction.
 if count_attempts>10 or digest !~ '^[a-f0-9]{64}$' then return false; end if;
 select * into l from public.license_keys where code_hash=digest for update;
 if not found or l.status not in ('available','assigned') or l.redeem_by<=now() or (l.organization_id is not null and l.organization_id<>oid) then return false; end if;
 if s.entitlement_source='provider' and private.organization_entitled(oid) then return false; end if;
 perform private.refresh_subscription(oid);
 -- Early renewal preserves remaining paid days, but never adds unused trial days.
 until_at=greatest(now(),case when s.status='active' and private.organization_entitled(oid) then s.current_period_end else now() end)+make_interval(months=>l.duration_months);
 update public.license_keys set status='active',organization_id=oid,activated_at=now(),expires_at=until_at where id=l.id;
 update public.organization_subscriptions set status='active',entitlement_source='license',license_key_id=l.id,
 current_period_start=now(),current_period_end=until_at,cancel_at_period_end=false,ended_at=null,provider_reference=null where id=s.id;
 insert into public.subscription_events(organization_id,subscription_id,event_type,metadata)
 values(oid,s.id,case when s.status='active' then 'subscription_renewed' else 'subscription_activated' end,jsonb_build_object('license_id',l.id,'current_period_end',until_at));
 return true;
end $$;
create function public.revoke_license(lid uuid) returns void language plpgsql security definer set search_path='' as $$
declare oid uuid; sid uuid;
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' then raise exception 'Internal access required' using errcode='42501'; end if;
 -- Lock in the same order as activation to avoid deadlocks.
 select organization_id into oid from public.license_keys where id=lid;
 select id into sid from public.organization_subscriptions where organization_id=oid for update;
 update public.license_keys set status='revoked' where id=lid;
 if not found then raise exception 'License unavailable'; end if;
 if sid is not null then
 insert into public.subscription_events(organization_id,subscription_id,event_type,metadata) values(oid,sid,'license_revoked',jsonb_build_object('license_id',lid));
 perform private.refresh_subscription(oid);
 end if;
end $$;
create function public.expire_subscriptions() returns integer language plpgsql security definer set search_path='' as $$
declare s record; processed integer=0;
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' then raise exception 'Internal access required' using errcode='42501'; end if;
 for s in select organization_id from public.organization_subscriptions where status in ('trialing','active') and not private.organization_entitled(organization_id) loop
 perform private.refresh_subscription(s.organization_id); processed=processed+1;
 end loop;
 return processed;
end $$;

-- Public booking functions are SECURITY DEFINER and must enforce billing too.
create function private.require_booking_subscription(slug text) returns void language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.clinics c where c.booking_slug=slug and c.public_booking_enabled and c.archived_at is null and private.organization_entitled(c.organization_id))
 then raise exception 'Booking unavailable' using errcode='42501'; end if;
end $$;
do $$ declare f record; definition text; begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('public_booking_catalog','public_available_slots','create_public_booking') loop
 definition=pg_get_functiondef(f.oid);
 definition=regexp_replace(definition,'\mbegin\M','begin perform private.require_booking_subscription(slug);','i');
 execute definition;
 end loop;
end $$;
create or replace function public.list_public_booking_clinics() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('slug',booking_slug,'name',name,'address',address,'timezone',timezone) order by name),'[]')
 from public.clinics where public_booking_enabled and booking_slug is not null and archived_at is null and private.organization_entitled(organization_id)
$$;
create function private.require_confirmation_subscription(digest text) returns void language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.appointment_confirmations c where c.token_hash=digest and c.revoked_at is null and c.expires_at>now() and private.organization_entitled(c.organization_id))
 then raise exception 'Confirmation unavailable' using errcode='42501'; end if;
end $$;
do $$ declare f record; definition text; begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('public_confirmation_details','public_confirmation_action') loop
 definition=pg_get_functiondef(f.oid);
 definition=regexp_replace(definition,'\mbegin\M',case when f.oid='public.public_confirmation_details(text,text)'::regprocedure then 'begin if not exists(select 1 from public.appointment_confirmations ac where ac.token_hash=token_digest and private.organization_entitled(ac.organization_id)) then return null; end if;' else 'begin perform private.require_confirmation_subscription(token_digest);' end,'i');
 execute definition;
 end loop;
 definition=pg_get_functiondef('public.patient_portal_home()'::regprocedure);
 if position('where i.user_id=auth.uid()' in definition)=0 then raise exception 'Unexpected portal definition'; end if;
 execute replace(definition,'where i.user_id=auth.uid()','where private.clinic_entitled(i.clinic_id) and i.user_id=auth.uid()');
end $$;
-- Service-role worker only claims jobs from entitled organizations.
do $$ declare definition text; begin
 definition=pg_get_functiondef('public.claim_notification_jobs(integer)'::regprocedure);
 if position('where (status in (' in definition)=0 then raise exception 'Unexpected notification claim definition'; end if;
 definition=replace(definition,'where (status in (','where private.organization_entitled(organization_id) and (status in (');
 execute definition;
 definition=pg_get_functiondef('public.notification_job_context(uuid)'::regprocedure);
 if position('where j.id=job_id' in definition)=0 then raise exception 'Unexpected notification context definition'; end if;
 execute replace(definition,'where j.id=job_id','where private.organization_entitled(j.organization_id) and j.id=job_id');
end $$;

revoke all on function private.start_organization_trial(),private.billing_owner(uuid),private.organization_entitled(uuid),private.clinic_entitled(uuid),private.refresh_subscription(uuid),private.require_booking_subscription(text) from public,anon,authenticated;
revoke all on function private.require_confirmation_subscription(text) from public,anon,authenticated;
grant execute on function private.billing_owner(uuid),private.organization_entitled(uuid),private.clinic_entitled(uuid) to authenticated;
revoke all on function public.organization_access(uuid),public.activate_license(uuid,text),public.issue_license(text,text,uuid,integer,timestamptz),public.revoke_license(uuid),public.expire_subscriptions() from public,anon,authenticated;
grant execute on function public.organization_access(uuid),public.activate_license(uuid,text) to authenticated;
grant execute on function public.issue_license(text,text,uuid,integer,timestamptz),public.revoke_license(uuid),public.expire_subscriptions() to service_role;
