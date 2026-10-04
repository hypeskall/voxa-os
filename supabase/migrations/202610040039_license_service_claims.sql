-- Preserve manual-license operations alongside Stripe on current PostgREST.
-- No entitlement or licensing rules change; only service-role claim decoding.
do $$ declare f record; body text; old_guard text := 'coalesce(current_setting(''request.jwt.claim.role'',true),'''')<>''service_role'''; begin
 for f in select p.oid,p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('issue_license','revoke_license','expire_subscriptions') loop
 if position(old_guard in f.prosrc)=0 then raise exception 'Unexpected license RPC definition'; end if;
 body=replace(pg_get_functiondef(f.oid),old_guard,'not private.stripe_service_request()');
 execute body;
 end loop;
end $$;
