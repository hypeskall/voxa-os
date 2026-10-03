# Voxa — production rollout checklist

This is a technical deployment checklist, not a certification of medical or GDPR compliance. Run it on a dedicated staging clinic before admitting real patients.

## Infrastructure and migrations

- [ ] Separate Supabase staging/production projects in a reviewed region; never copy local demo users/patients to production.
- [ ] Review and apply migrations 001–028 in order. Existing organizations are backfilled as configured; newly created organizations require onboarding. `clinics` are locations. Migration 028 records failed private upload cleanup for operator reconciliation.
- [ ] Verify RLS on all tenant tables and `storage.objects`; verify `voxa-medical` and `voxa-branding` are private and MIME/size limits are active.
- [ ] Verify the interface's aggregate 3 MB upload limit and the 4 MB Server Actions body limit with actual files. Legacy bucket limits are larger for existing objects; a larger-file interface requires a separate signed upload flow.
- [ ] Verify private schema is not exposed by PostgREST. Keep `service_role` restricted to existing server worker/portal provisioning modules.
- [ ] Configure URL and publishable/anon key, canonical HTTPS `APP_ORIGIN`, notification/confirmation/worker secrets; no private `NEXT_PUBLIC_*` keys.
- [ ] Supabase Auth: enable email signup and email confirmation, restrict redirect URLs to the actual `/auth/callback`, review rate limits and password policy, configure production SMTP, verify deliverability and recovery.
- [ ] Enable email change confirmation, leaked-password checks/MFA according to clinic policy; test session revocation. No public platform super-admin is exposed.
- [ ] Vercel: Node 24, Next.js preset, `npm ci`, `npm run build`, custom domain, HTTPS and environment-specific configuration. No authenticated CDN caching.
- [ ] Enable error monitoring with PII scrubbing, and inspect server logs without logging patient fields or bearer links.
- [ ] Keep notification delivery disabled until the real webhook provider is configured and idempotency/retry behavior is verified.
- [ ] Configure scheduler with `docs/NOTIFICATION_SCHEDULER.md`. Staff invitations support an authenticated email adapter; manual delivery is labeled as a staging fallback. Verify actual provider acceptance and inbox delivery separately.
- [ ] Complete every hosted gate in `docs/HOSTED_STAGING.md`; local acceptance and schema equality alone do not establish readiness.
- [ ] Reconcile pending `storage_cleanup_jobs`; preserve registered originals and document reviewed physical deletion/retention scope.

## Backup and recovery

- [ ] Select Supabase/PostgreSQL backup and PITR settings suitable for the agreed recovery objectives; review current plan support.
- [ ] Back up Storage objects independently of database metadata. A database backup alone cannot recreate uploaded PDFs/images.
- [ ] Define who can restore backups, encrypt/protect exported backups, and rehearse restoration into an isolated environment.
- [ ] Document erasure/anonymization handling for restored backups, outboxes, logs, Storage and providers; retain the necessary audit trail.

## Privacy and clinic operations

- [ ] Approve privacy notice, legal basis, DPA, processors/subprocessors, international transfers, retention periods and staff procedures with responsible advisors.
- [ ] Define patient identity verification for access/erasure requests and the breach response procedure. See `docs/PRIVACY_OPERATIONS.md`.
- [ ] Review default working hours (08:00–18:00 weekdays), doctor/room schedules, service durations, eligibility and cabinet requirements with the clinic. These are editable defaults, not medical recommendations.
- [ ] Doctors invited as staff must be linked to their local professional affiliation before their personal schedule appears.
- [ ] Assign at least one active OWNER per organization and location; test transfer by adding another owner before removing access.
- [ ] Confirm onboarding resources and sensitive export access. Optional CNP collection requires a reviewed purpose and access policy. Format validation checks 13 digits, not identity authenticity. CNP is excluded from lists, search, and the doctor workflow projection.

## Release validation

- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run build` pass on the release revision.
- [ ] Run the complete acceptance scenario on hosted Supabase: real email signup/verification/login, persisted setup, patient/appointment, refresh/logout/login.
- [ ] Create a second real staging organization; try crafted read/update/upload/settings requests and revoked sessions.
- [ ] Check receptionist owner-only routes and a doctor's own appointments/patients/notes, with a second doctor's records excluded.
- [ ] Upload and download real private files through Supabase Storage; check signed URL expiry and cleanup behavior. Database tests execute actual RLS policies but do not emulate the Storage HTTP service.
- [ ] Test invitation acceptance with matching/mismatched/unverified email, expiry, replay and revocation. Keep tokens out of logs and analytics.
- [ ] Inspect dashboard, registries, calendar, settings, team, reports, documents, portal, errors/empty states at 1920/1440/1024/768/390px; inspect browser console and network.
- [ ] Run a multi-connection PostgreSQL scheduling/load test. PGlite serializes one connection; passing local tests alone is not a hosted concurrency/load certification.

The full hosted acceptance scenario remains unverified until these staging checks have actually been run. Do not treat local Auth protocol fixtures as evidence of SMTP delivery or a completed live deployment.
