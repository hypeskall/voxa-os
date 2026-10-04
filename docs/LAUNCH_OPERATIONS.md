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

Current archives are local, encrypted and Git/deploy-ignored, not off-device scheduled backups. Before medical-data launch, choose approved external storage, separate key custody, retention, RPO/RTO and schedule; test full hosted recovery into an isolated target. Supabase [database backups do not contain actual Storage files](https://supabase.com/docs/guides/platform/backups). Reconcile approved erasures after restore, including outboxes/provider state. Never automatically enable notification processing after recovery.

## Monitoring and incidents

An external monitor should check `GET /api/health`, treating non-200 as unavailable. It requires no secret and exposes no tenant data. Choose a provider and responder/escalation policy. Current monitoring supplies readiness, scrubbed logs and per-instance throttled SMTP alerts to `ERROR_ALERT_EMAIL`, not a globally deduplicated alert service or provisioned uptime monitor.

For incidents, record UTC time/displayed reference, inspect matching hosting logs, identify release/configuration/database connectivity and contain the workflow. Do not copy passwords, bearer links or patient content into tickets/email. Preserve an encrypted recovery point before repairs. Decide clinic notification with the responsible operator; error logs cannot make legal decisions.

## SMTP and uncertain delivery

Auth and application invitation SMTP are configured independently. Patient delivery remains disabled. The private ledger stores only a key digest, timestamps and sending/accepted/uncertain state. Acceptance means the SMTP server accepted the message, not inbox delivery. Sending/uncertain requires verification and is never automatically retried. Do not blindly reset ledger state. Inspect provider evidence; revoke/reissue invitations when appropriate. Test with controlled accounts, not real patient contact.

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
