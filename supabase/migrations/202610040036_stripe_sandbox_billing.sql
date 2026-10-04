-- Sandbox adapter: browser roles can only read a billing summary.
create table public.organization_stripe_billing (
 organization_id uuid primary key references public.organizations(id),
 customer_id text unique, subscription_id text unique, status text,
 checkout_id text unique, checkout_expires_at timestamptz,
 checkout_attempt uuid not null default gen_random_uuid(), checkout_trial_end bigint,
 lease_token uuid, lease_until timestamptz,
 updated_at timestamptz not null default now()
);
alter table public.organization_stripe_billing enable row level security;
create policy stripe_owner_read on public.organization_stripe_billing for select to authenticated
 using(private.billing_owner(organization_id) and private.mfa_satisfied());
revoke all on public.organization_stripe_billing from public,anon,authenticated;
grant select(organization_id,customer_id,subscription_id,status,updated_at) on public.organization_stripe_billing to authenticated;
grant all on public.organization_stripe_billing to service_role;
create table private.stripe_processed_events (
 event_id text primary key, organization_id uuid not null references public.organizations(id),
 event_type text not null, processed_at timestamptz not null default now()
);

create function public.stripe_billing_lock(oid uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b public.organization_stripe_billing; s public.organization_subscriptions; token uuid;
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' then raise exception 'Internal access required' using errcode='42501'; end if;
 select * into s from public.organization_subscriptions where organization_id=oid for update;
 if not found then raise exception 'Unknown organization'; end if;
 insert into public.organization_stripe_billing(organization_id,checkout_trial_end)
 values(oid,case when s.trial_ends_at>now()+interval '2 days' then extract(epoch from s.trial_ends_at)::bigint end)
 on conflict(organization_id) do nothing;
 select * into b from public.organization_stripe_billing where organization_id=oid for update;
 if b.lease_until>now() then raise exception 'Billing busy'; end if;
 token=gen_random_uuid();
 update public.organization_stripe_billing set lease_token=token,lease_until=now()+interval '2 minutes' where organization_id=oid;
 return to_jsonb(b)||jsonb_build_object('lease_token',token,'trial_ends_at',s.trial_ends_at,
 'license_active',s.entitlement_source='license' and private.organization_entitled(oid));
end $$;

create function public.stripe_billing_save(oid uuid,token uuid,payload jsonb) returns void
language plpgsql security definer set search_path='' as $$
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' then raise exception 'Internal access required' using errcode='42501'; end if;
 perform 1 from public.organization_subscriptions where organization_id=oid for update;
 perform 1 from public.organization_stripe_billing where organization_id=oid and lease_token=token and lease_until>now() for update;
 if not found then raise exception 'Billing lease expired'; end if;
 if payload ? 'customer_id' then
 update public.organization_stripe_billing set customer_id=payload->>'customer_id' where organization_id=oid;
 end if;
 if payload ? 'checkout_id' then
 update public.organization_stripe_billing set checkout_id=payload->>'checkout_id',checkout_expires_at=(payload->>'checkout_expires_at')::timestamptz where organization_id=oid;
 end if;
 if payload->>'reset_checkout'='true' then
 update public.organization_stripe_billing set checkout_id=null,checkout_expires_at=null,checkout_attempt=gen_random_uuid(),
 checkout_trial_end=case when (select trial_ends_at from public.organization_subscriptions where organization_id=oid)>now()+interval '2 days'
 then (select extract(epoch from trial_ends_at)::bigint from public.organization_subscriptions where organization_id=oid) end where organization_id=oid;
 end if;
 if payload->>'release'='true' then
 update public.organization_stripe_billing set lease_token=null,lease_until=null where organization_id=oid;
 end if;
end $$;

create function public.stripe_billing_apply(oid uuid,token uuid,eid text,kind text,snapshot jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare b public.organization_stripe_billing; s public.organization_subscriptions; next_status text; changed boolean;
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' then raise exception 'Internal access required' using errcode='42501'; end if;
 select * into s from public.organization_subscriptions where organization_id=oid for update;
 select * into b from public.organization_stripe_billing where organization_id=oid for update;
 if b.lease_token is distinct from token or b.lease_until<=now() then raise exception 'Billing lease expired'; end if;
 if b.customer_id is distinct from snapshot->>'customer_id' then raise exception 'Customer mismatch'; end if;
 insert into private.stripe_processed_events(event_id,organization_id,event_type) values(eid,oid,kind) on conflict do nothing;
 if not found then return false; end if;
 update public.organization_stripe_billing set subscription_id=snapshot->>'subscription_id',status=snapshot->>'stripe_status',checkout_expires_at=null,updated_at=now() where organization_id=oid;
 -- Existing manual paid access survives all provider events.
 if s.entitlement_source='license' and private.organization_entitled(oid) then return true; end if;
 next_status=case when snapshot->>'paid'='true' and snapshot->>'stripe_status'='active' then 'active'
 when s.trial_ends_at>now() then 'trialing'
 when snapshot->>'stripe_status'='past_due' then 'past_due'
 when snapshot->>'stripe_status'='canceled' then 'canceled' else 'inactive' end;
 if next_status='active' and ((snapshot->>'period_end')::timestamptz<=(snapshot->>'period_start')::timestamptz
 or snapshot->>'period_end' is null or snapshot->>'period_start' is null) then raise exception 'Invalid paid period'; end if;
 changed = s.status is distinct from next_status or s.current_period_end is distinct from (snapshot->>'period_end')::timestamptz
 or s.cancel_at_period_end is distinct from (snapshot->>'cancel_at_period_end')::boolean or s.provider_reference is distinct from snapshot->>'subscription_id';
 update public.organization_subscriptions set status=next_status,entitlement_source='provider',provider_reference=snapshot->>'subscription_id',license_key_id=null,
 current_period_start=case when next_status='active' then (snapshot->>'period_start')::timestamptz end,
 current_period_end=case when next_status='active' then (snapshot->>'period_end')::timestamptz end,
 cancel_at_period_end=coalesce((snapshot->>'cancel_at_period_end')::boolean,false),
 ended_at=case when next_status in ('canceled','inactive') then now() end where id=s.id;
 if changed then
 insert into public.subscription_events(organization_id,subscription_id,event_type,metadata)
 values(oid,s.id,'stripe_subscription_updated',jsonb_build_object('status',next_status,'stripe_status',snapshot->>'stripe_status','event_id',eid));
 end if;
 return true;
end $$;

create function private.guard_license_during_stripe() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.entitlement_source='license' and (old.license_key_id is distinct from new.license_key_id) and exists(
 select 1 from public.organization_stripe_billing where organization_id=new.organization_id
 and (status in ('active','trialing','past_due','unpaid','incomplete','paused') or checkout_expires_at>now() or lease_until>now())) then
 raise exception 'Close Stripe billing before activating a license';
 end if;
 return new;
end $$;
create trigger guard_license_stripe before update on public.organization_subscriptions for each row execute function private.guard_license_during_stripe();
revoke all on function public.stripe_billing_lock(uuid),public.stripe_billing_save(uuid,uuid,jsonb),public.stripe_billing_apply(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.stripe_billing_lock(uuid),public.stripe_billing_save(uuid,uuid,jsonb),public.stripe_billing_apply(uuid,uuid,text,text,jsonb) to service_role;
