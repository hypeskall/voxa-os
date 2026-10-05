-- Add the annual plan without changing existing monthly subscriptions or access controls.
alter table public.organization_subscriptions drop constraint organization_subscriptions_plan_check;
alter table public.organization_subscriptions add constraint organization_subscriptions_plan_check check (plan in ('voxa_os_monthly','voxa_os_annual'));
alter table public.organization_subscriptions drop constraint organization_subscriptions_billing_cycle_check;
alter table public.organization_subscriptions add constraint organization_subscriptions_billing_cycle_check check (billing_cycle in ('monthly','annual'));

create or replace function public.stripe_billing_apply(oid uuid,token uuid,eid text,kind text,snapshot jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare b public.organization_stripe_billing; s public.organization_subscriptions; next_status text; changed boolean;
begin
 if not private.stripe_service_request() then raise exception 'Internal access required' using errcode='42501'; end if;
 if coalesce(snapshot->>'billing_cycle','monthly') not in ('monthly','annual') then raise exception 'Invalid billing cycle'; end if;
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
 update public.organization_subscriptions set billing_cycle=coalesce(snapshot->>'billing_cycle','monthly'),plan=case when snapshot->>'billing_cycle'='annual' then 'voxa_os_annual' else 'voxa_os_monthly' end,status=next_status,entitlement_source='provider',provider_reference=snapshot->>'subscription_id',license_key_id=null,
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

