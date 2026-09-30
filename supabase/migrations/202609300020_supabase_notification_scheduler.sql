-- Optional locally (PGlite has no background workers); installed on Supabase.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
  end if;
  if exists (select 1 from pg_available_extensions where name = 'supabase_vault') then
    create extension if not exists supabase_vault with schema vault;
  end if;
end $$;

create schema if not exists private;

create or replace function private.dispatch_notification_worker()
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  worker_origin text;
  worker_secret text;
  request_id bigint;
begin
  if to_regclass('vault.decrypted_secrets') is null then return null; end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1'
    into worker_origin using 'voxa_notification_origin';
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1'
    into worker_secret using 'voxa_notification_cron_secret';
  if worker_origin is null or worker_secret is null then return null; end if;
  execute 'select net.http_post(url := $1, headers := $2, body := $3, timeout_milliseconds := 60000)'
    into request_id using worker_origin || '/api/internal/notifications/process',
      jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || worker_secret),
      '{}'::jsonb;
  return request_id;
end $$;
revoke all on function private.dispatch_notification_worker() from public, anon, authenticated, service_role;

-- Provisioning is separate from migration: a deployment origin and secrets are not source code.
create or replace function public.configure_notification_scheduler(worker_origin text, worker_secret text, enabled boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
declare
  secret_id uuid;
  scheduler_id bigint;
begin
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
     nullif(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if worker_origin is null or worker_origin !~ '^https://[a-zA-Z0-9][a-zA-Z0-9.-]*(:[0-9]+)?/?$'
     or length(worker_origin) > 250 then raise exception 'A production HTTPS origin is required'; end if;
  if worker_secret is null or length(worker_secret) < 32 or worker_secret ~ '[[:space:]]' then
    raise exception 'CRON_SECRET must contain at least 32 characters without whitespace';
  end if;
  if to_regclass('cron.job') is null or to_regclass('vault.decrypted_secrets') is null
     or not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise exception 'Supabase Cron, pg_net and Vault are required; use the manual endpoint locally';
  end if;
  perform pg_advisory_xact_lock(946230020);
  execute 'select id from vault.secrets where name = $1' into secret_id using 'voxa_notification_origin';
  if secret_id is null then
    execute 'select vault.create_secret($1, $2)' using rtrim(worker_origin, '/'), 'voxa_notification_origin';
  else
    execute 'select vault.update_secret($1, $2)' using secret_id, rtrim(worker_origin, '/');
  end if;
  secret_id := null;
  execute 'select id from vault.secrets where name = $1' into secret_id using 'voxa_notification_cron_secret';
  if secret_id is null then
    execute 'select vault.create_secret($1, $2)' using worker_secret, 'voxa_notification_cron_secret';
  else
    execute 'select vault.update_secret($1, $2)' using secret_id, worker_secret;
  end if;
  execute 'select cron.schedule($1, $2, $3)' into scheduler_id
    using 'voxa-notification-worker', '*/5 * * * *', 'select private.dispatch_notification_worker();';
  execute 'select cron.alter_job($1, active := $2)' using scheduler_id, enabled;
end $$;
revoke all on function public.configure_notification_scheduler(text, text, boolean) from public, anon, authenticated;
grant execute on function public.configure_notification_scheduler(text, text, boolean) to service_role;

-- Register inactive until the production secret and origin have been provisioned.
do $$
declare scheduler_id bigint;
begin
  if to_regclass('cron.job') is null then
    raise notice 'pg_cron unavailable: use authenticated manual processing in local development';
    return;
  end if;
  execute 'select jobid from cron.job where jobname = $1' into scheduler_id using 'voxa-notification-worker';
  if scheduler_id is null then
    execute 'select cron.schedule($1, $2, $3)' into scheduler_id
      using 'voxa-notification-worker', '*/5 * * * *', 'select private.dispatch_notification_worker();';
    execute 'select cron.alter_job($1, active := false)' using scheduler_id;
  end if;
end $$;
