# Launch operations

Production: https://voxa-os.vercel.app / Supabase `fibcbsdattoqiyizzeda`.
Protected staging: https://voxa-os-staging-voxa6.vercel.app / Supabase `wlnrfjrjkyywqyvsngps`.

## Release

1. Run lint, typecheck, tests, browser checks and build. Apply new migrations to staging; verify exact schema equality and hosted acceptance first.
2. Capture an encrypted production snapshot with `node scripts/recovery-snapshot.mjs capture`. Operator token, service key and a distinct 256-bit encryption key live only in ignored `.env.production.local`. Preserve the key separately in approved custody; losing it loses the snapshot. Do not upload operator tokens or backup keys to Vercel.
3. Run `node scripts/production-release.mjs check`, then `apply` only for a matching baseline and verified snapshot less than one hour old. Historical production migration IDs differ from the repo's oldest IDs. Never reset, seed, repair old IDs or rewrite applied SQL to hide drift. Unknown drift requires review.
4. Deploy and check `/api/health`, public Auth and protected routes. Record deployment/revision. Prefer forward fixes; application rollback alone cannot reverse a migration safely.
5. Keep `NOTIFICATION_DELIVERY_ENABLED=false` and the scheduler disabled until approved. Manual license activation remains while Stripe is deferred; grant customer access only after an approved business decision.

## Recovery

`recovery-snapshot.mjs capture` encrypts table rows, catalog/history and Storage contents with AES-256-GCM. It verifies decryption/file hashes before producing a receipt. Database rows use one MVCC query; Storage is captured separately. Pause writes/uploads during capture for an operational recovery point. This in-memory tool serves the current small dataset; it does not replace physical PostgreSQL backups.

Verify with `node scripts/recovery-snapshot.mjs verify .backups/FILE.voxa`. Rehearse synthetic data by setting `RECOVERY_ENV_FILE=.env.staging.local` and running `node scripts/recovery-snapshot.mjs drill .backups/STAGING_FILE.voxa`. The drill compares every public application record locally and verifies Storage bytes. It does not restore hosted Auth, private runtime tables or objects into Supabase. Production snapshots are rejected for drills.

Encrypted archives now have verified off-device EU R2 copies and an approved private daily GitHub runner. Full isolated Auth/private-table/Storage recovery passed; see [current acceptance](ACCEPTANCE_1_4_2026-10-04.md) for exact evidence and scheduled-trigger status. Owner key custody is confirmed; retention and RPO/RTO remain operator decisions. Supabase [database backups do not contain actual Storage files](https://supabase.com/docs/guides/platform/backups). Reconcile approved erasures and outbox/provider state after recovery. Never automatically enable notification processing.

The installed R2 transfer checks private domains, uploads ciphertext conditionally and downloads/verifies it before writing a receipt. Procedure: [BACKUP_SETUP.md](BACKUP_SETUP.md). Credentials remain in approved private operator/runner custody and are not exported to the public code repo or Vercel.

## Monitoring and incidents

The `Voxa production readiness` GitHub workflow runs public checks at minutes 7, 22, 37 and 52 each hour and supports manual dispatch. It checks database readiness, rendered login/register/recovery forms, anonymous dashboard redirection (including Next.js streamed redirects) and the absence of staging status in production. Failed checks are retried once after ten seconds. It uses no private credentials, submits no forms and logs only check paths/status; it does not process notifications or upload artifacts. Run locally with `npm run monitor:check`. Change the repository variable `VOXA_APP_ORIGIN` after a hosting migration; the default is the current production origin.

This is an independent, best-effort readiness check, not a guaranteed uptime service. [GitHub schedules can be delayed or dropped and inactive public repositories lose schedules after 60 days](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows). Enable failed-workflow email/web notifications in the owner's [GitHub notification settings](https://github.com/settings/notifications); this preference and inbox delivery have not been verified. [Scheduled notifications go to the user who last changed the cron](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs). Assign a responder and add a dedicated uptime provider before promising incident response. Existing scrubbed logs and per-instance throttled SMTP request-error alerts remain configured independently.

Production Auth requires confirmation and 12-character new passwords. [Account MFA](ACCOUNT_MFA.md) is now implemented and enforced in the app, RPCs, RLS and private Storage after factor verification; personal enrollment remains a user action. Leaked-password protection is disabled; Supabase [offers it on Pro and above](https://supabase.com/docs/guides/auth/password-security), so no upgrade was enabled. Brevo's authenticated `notify.voxatech.ro` handles production transactional messages; the root domain/Zoho mailbox remain unchanged. Recovery, staff-invitation and deliberate operator-alert Inbox receipt are owner-confirmed.

For incidents, record UTC time/displayed reference, inspect matching hosting logs, identify release/configuration/database connectivity and contain the workflow. Do not copy passwords, bearer links or patient content into tickets/email. Preserve an encrypted recovery point before repairs. Decide clinic notification with the responsible operator; error logs cannot make legal decisions.

## SMTP and uncertain delivery

Auth and application invitation SMTP are configured independently. Patient delivery remains disabled. The private ledger stores only a key digest, timestamps and sending/accepted/uncertain state. Acceptance means the SMTP server accepted the message, not inbox delivery. Sending/uncertain requires verification and is never automatically retried. Do not blindly reset ledger state. Inspect provider evidence; revoke/reissue invitations when appropriate. Test with controlled accounts, not real patient contact.

Zoho Mail's current usage policy excludes automated/transactional sending. New sending must use an approved transactional provider; the Brevo migration procedure is in [TRANSACTIONAL_EMAIL_SETUP.md](TRANSACTIONAL_EMAIL_SETUP.md). The operator configurator no longer reapplies ordinary Zoho Mail credentials. Historical Zoho acceptance evidence remains historical and does not establish permission for a commercial transactional workload.

## First clinic pilot

- Approve legal/privacy/retention, hosting/recovery gates and contacts.
- Start with synthetic records; complete signup, confirmation, recovery and onboarding.
- Verify actual working hours, service durations, doctor affiliation and room constraints.
- Invite receptionist/doctor; prove allowed work and denial of owner actions. Keep a second owner before ownership removal.
- Create/reschedule/confirm/complete/cancel appointments; verify history and slot release after reconnect.
- Test controlled private files, signed-link expiry, foreign-clinic denial and export/privacy handling.
- Agree support availability, incident response and acceptable recovery loss/time. Do not promise 24/7 support or an untested SLA.
- Review trial expiry/license experience. Stripe is a later release.

## Costs and dependencies

Record actual plan/seats/usage limits and budget for Vercel, Supabase database/Storage/egress/backups, SMTP, monitoring, support and future Stripe, including staging. Current Vercel is Hobby; commercial use needs Pro/Enterprise per [provider policy](https://vercel.com/docs/limits/fair-use-guidelines). No paid service was enabled. Tax/VAT and final customer terms await company details/review.

Runtime audit: zero known advisories. Five high development-tool advisories remain in ESLint → fast-glob → micromatch → braces. At review, the [upstream advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) has no patched version. Avoid the automated downgrade of Next lint configuration; recheck upstream and keep dev tooling away from untrusted input.
