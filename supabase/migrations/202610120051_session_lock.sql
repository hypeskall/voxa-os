-- Activity is server-owned and tied to the provider's real session, never a
-- browser-supplied timestamp. Expired/revoked sessions cannot be revived.
create table private.session_activity (
 session_id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 started_at timestamptz not null,
 last_activity_at timestamptz not null default now(),
 locked_at timestamptz
);
alter table private.session_activity enable row level security;
revoke all on private.session_activity from public,anon,authenticated;
grant select,insert,update,delete on private.session_activity to service_role;

create function private.current_session_id() returns uuid language plpgsql stable set search_path='' as $$
declare value text; begin
 value=nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id';
 if value is null or value !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then return null; end if;
 return value::uuid;
end $$;
create function private.session_satisfied() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is null or exists(
  select 1 from private.session_activity a join auth.sessions s on s.id=a.session_id and s.user_id=a.user_id
  where a.session_id=private.current_session_id() and a.user_id=auth.uid() and a.locked_at is null
   and a.last_activity_at>now()-interval '10 minutes' and a.started_at>now()-interval '8 hours'
   and (s.not_after is null or s.not_after>now())
 )
$$;
create function public.session_status(activity boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare sid uuid=private.current_session_id(); uid uuid=auth.uid(); started timestamptz; a private.session_activity;
begin
 if sid is null or uid is null then return jsonb_build_object('allowed',false); end if;
 select created_at into started from auth.sessions where id=sid and user_id=uid and (not_after is null or not_after>now());
 if started is null or started<=now()-interval '8 hours' then return jsonb_build_object('allowed',false); end if;
 insert into private.session_activity(session_id,user_id,started_at) values(sid,uid,started) on conflict(session_id) do nothing;
 select * into a from private.session_activity where session_id=sid and user_id=uid for update;
 if a.session_id is null or a.locked_at is not null or a.last_activity_at<=now()-interval '10 minutes' or a.started_at<=now()-interval '8 hours' then
  update private.session_activity set locked_at=coalesce(locked_at,now()) where session_id=sid and user_id=uid;
  return jsonb_build_object('allowed',false);
 end if;
 if activity then update private.session_activity set last_activity_at=now() where session_id=sid and user_id=uid returning * into a; end if;
 return jsonb_build_object('allowed',true,'idleExpiresAt',extract(epoch from a.last_activity_at+interval '10 minutes')*1000,'absoluteExpiresAt',extract(epoch from a.started_at+interval '8 hours')*1000,'fresh',a.started_at>now()-interval '5 minutes');
end $$;
create function private.require_fresh_session() returns void language plpgsql stable security definer set search_path='' as $$
begin
 if not private.session_satisfied() or not exists(select 1 from private.session_activity where session_id=private.current_session_id() and user_id=auth.uid() and started_at>now()-interval '5 minutes') then
  raise exception 'Fresh authentication required' using errcode='42501';
 end if;
end $$;
revoke all on function private.current_session_id(),private.session_satisfied(),private.require_fresh_session(),public.session_status(boolean) from public,anon;
grant execute on function private.current_session_id(),private.session_satisfied() to authenticated,service_role;
grant execute on function public.session_status(boolean) to authenticated;

-- Every existing tenant/RLS check already depends on mfa_satisfied; retain its
-- exact factor/policy behavior while also checking live activity and revocation.
create or replace function private.mfa_satisfied() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is null or (private.session_satisfied() and (
  (coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'aal','aal1')='aal2' and exists(select 1 from auth.mfa_factors where user_id=auth.uid() and status='verified'))
  or (not private.privileged_mfa_required() and not exists(select 1 from auth.mfa_factors where user_id=auth.uid() and status='verified'))
 ))
$$;
-- Guard the RPC itself, including callers bypassing the application UI.
do $$ declare f record; body text; begin
 for f in select p.oid,p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('export_patient','record_report_export','set_organization_mfa_policy') loop
  body=regexp_replace(f.prosrc,'\mBEGIN\M',E'BEGIN\n perform private.require_fresh_session();','i');
  if body=f.prosrc then raise exception 'Fresh-session guard could not be applied'; end if;
  execute replace(pg_get_functiondef(f.oid),f.prosrc,body);
 end loop;
end $$;
notify pgrst,'reload schema';
