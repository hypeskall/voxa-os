-- MFA is optional until enrolled; a verified factor requires AAL2 for private data.
-- Provider-owned auth.mfa_factors is read only through this fixed-search-path helper.
create function private.mfa_satisfied() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is null
   or coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'aal','aal1')='aal2'
   or not exists(select 1 from auth.mfa_factors where user_id=auth.uid() and status='verified')
$$;
create function private.require_mfa() returns void language plpgsql stable security definer set search_path='' as $$
begin
 if not private.mfa_satisfied() then raise exception 'MFA verification required' using errcode='42501'; end if;
end $$;
revoke all on function private.mfa_satisfied(),private.require_mfa() from public;
grant execute on function private.mfa_satisfied(),private.require_mfa() to anon,authenticated,service_role;

-- Restrictive policies supplement every existing tenant/role/subscription policy.
do $$ declare t record; begin
 for t in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' and c.relrowsecurity loop
  execute format('create policy mfa_required on public.%I as restrictive for all to authenticated using((select private.mfa_satisfied())) with check((select private.mfa_satisfied()))',t.relname);
 end loop;
 if to_regclass('storage.objects') is not null then
  execute 'create policy voxa_mfa_required on storage.objects as restrictive for all to authenticated using((select private.mfa_satisfied())) with check((select private.mfa_satisfied()))';
 end if;
end $$;

-- Security-definer RPCs bypass RLS: guard their entry, preserving signatures, ACLs,
-- defaults, volatility, existing bodies and fixed search paths. Anonymous callers
-- without an account retain the existing public-booking capability checks.
do $$ declare f record; body text; begin
 for f in select p.oid,p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
 where n.nspname='public' and p.prokind='f' and l.lanname='plpgsql' and has_function_privilege('authenticated',p.oid,'execute') loop
  body=regexp_replace(f.prosrc,'\mBEGIN\M',E'BEGIN\n perform private.require_mfa();','i');
  if body=f.prosrc then raise exception 'MFA guard could not be applied'; end if;
  execute replace(pg_get_functiondef(f.oid),f.prosrc,body);
 end loop;
end $$;
create or replace function public.my_permissions(cid uuid) returns setof text language sql stable security definer set search_path='' as $$
 select r.permission from public.clinic_memberships m join public.role_permissions r on r.role=m.role join public.clinics c on c.id=m.clinic_id
 where m.user_id=auth.uid() and m.clinic_id=cid and m.active and c.archived_at is null and private.clinic_entitled(cid) and private.mfa_satisfied()
$$;
