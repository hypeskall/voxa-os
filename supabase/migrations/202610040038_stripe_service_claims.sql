-- Current PostgREST exposes claims as JSON, not individual claim settings.
-- Preserve the individual setting fallback for local SQL fixtures/older servers.
create function private.stripe_service_request() returns boolean language sql stable set search_path='' as $$
 select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role',
 nullif(current_setting('request.jwt.claim.role',true),''),'')='service_role'
$$;
revoke all on function private.stripe_service_request() from public,anon,authenticated;
grant execute on function private.stripe_service_request() to service_role;
do $$ declare f record; body text; old_guard text := 'coalesce(current_setting(''request.jwt.claim.role'',true),'''')<>''service_role'''; begin
 for f in select p.oid,p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('stripe_billing_lock','stripe_billing_save','stripe_billing_apply') loop
 if position(old_guard in f.prosrc)=0 then raise exception 'Unexpected Stripe RPC definition'; end if;
 body=replace(pg_get_functiondef(f.oid),old_guard,'not private.stripe_service_request()');
 execute body;
 end loop;
end $$;
