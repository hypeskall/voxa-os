# Scheduler notifications — Supabase

Vercel has no cron jobs (`vercel.json` explicitly declares an empty list).
Migration `202609300020_supabase_notification_scheduler.sql` installs available
`pg_cron`, `pg_net` and Supabase Vault extensions and registers one initially
inactive job, `voxa-notification-worker`, every five minutes. It calls the existing
protected POST `/api/internal/notifications/process`. GitHub Actions is manual only.

## Production activation

1. Apply versioned migrations (020 scheduler and 021 worker acknowledgements)
   with `supabase db push` against the intended linked
   production project. Supabase must offer all three extensions. An extension
   installation failure fails the migration; it is not silently ignored.
2. Deploy on Vercel Hobby. Configure server-only `CRON_SECRET` (random, at least
   32 characters, no whitespace), `SUPABASE_SERVICE_ROLE_KEY`, and `APP_ORIGIN`
   (the stable production HTTPS origin). Configure Supabase public URL/key and the
   notification provider from `.env.example`. The development provider does not
   deliver real SMS/email. Protect the worker from preview deployment redirects;
   its production URL must be reachable by Supabase with Bearer authentication.
3. Create a gitignored `.env.production.local` containing those same server
   values and `NEXT_PUBLIC_SUPABASE_URL`. In PowerShell run:

   ```powershell
   $env:NOTIFICATION_ENV_FILE = '.env.production.local'
   npm run notifications:scheduler:configure
   Remove-Item Env:NOTIFICATION_ENV_FILE
   ```

   The service-role-only configuration RPC stores the origin and Bearer secret
   in Vault and activates the job. It can be rerun safely to rotate either value;
   it updates the existing named job. No service-role key is stored in cron or
   sent to the worker. The cron command contains only a private function call.
   To pause, rerun with `NOTIFICATION_SCHEDULER_ENABLED=false` in that env file.

4. Verify `cron.job` has the named active job and the expected schedule. Inspect
   `cron.job_run_details` for failures, then `net._http_response` for actual HTTP
   results (cron success alone only confirms request submission). Check queued,
   failed and stale SENDING records in `notification_jobs` and the communication
   log. Alert operationally on repeated HTTP failures and queue backlog.

## Local/manual processing

PGlite and PostgreSQL without the optional extensions cannot reproduce the
background scheduler. Migration still creates the configuration function, which
reports missing extensions instead of pretending to activate a job. With the
app running and `.env.local` configured, run `npm run notifications:process`.
This uses the same authenticated endpoint, real queue and authorization as cron.
It allows HTTP only for localhost, refuses redirects, and never prints secrets
or recipients. For production manual checks, use the production env file as
above. The existing manual GitHub workflow remains an alternative, using its
repository origin variable and CRON_SECRET secret.

## Retry and capacity

Existing unique reminder/channel keys prevent duplicate enqueueing. Atomic
`FOR UPDATE SKIP LOCKED` claims prevent competing workers from processing the
same job; completed jobs are not reclaimed. Stale SENDING leases expire after
15 minutes. Provider calls retain the same `Idempotency-Key` on every retry.
**The production webhook/provider must enforce that key**: without provider
deduplication, exactly-once external delivery cannot be guaranteed after an
accepted request whose response or database acknowledgement was lost.

The worker handles up to 25 jobs concurrently per invocation (provider timeout
15 seconds, endpoint budget 60 seconds). It enqueues reminders before claiming
work and fails visibly on DB errors. A delivery accepted by the provider but not
acknowledged in the DB retains its lease for a safe retry using the same key.
At five-minute cadence this serves up to 300 jobs/hour; monitor backlog and scale
worker capacity deliberately for larger clinics. Reminder generation uses the
existing due-time window; prolonged scheduler outages require an operational
review of missed reminders, not blind delivery of obsolete messages.

References: [Supabase scheduling with Cron, Vault and pg_net](https://supabase.com/docs/guides/functions/schedule-functions),
[Vercel cron plan limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).
