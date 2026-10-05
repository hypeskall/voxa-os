# Voxa SaaS implementation report — 2 October 2026

**Historical local baseline.** The later [live acceptance](STRIPE_LIVE.md) and [5 October audit](DEEP_AUDIT_2026-10-05.md) document hosted deployment, automated staff/patient email, billing enforcement, MFA, restored Auth/private/Storage and reception results. The limitations/test counts below describe 2 October, not the current release. Voice integrations remain excluded.

Follow-up staging work and current verification/access blockers are recorded in [HOSTED_STAGING_REPORT.md](HOSTED_STAGING_REPORT.md). The implementation/test counts below describe the preceding local baseline; the new report includes migration 028 and the latest checks.

The repository now implements self-service clinic setup and tenant-scoped clinical workflows using its existing Next.js/Supabase architecture. No hosted migrations, email deliveries, or deployment were performed. Local verification is distinguished below from the hosted checks that the clinic must still run.

## 1. Architecture implemented

Retained Next.js 16.3 App Router, React, TypeScript, existing components/design, Supabase Auth/PostgreSQL/Storage, and feature-based server repositories/actions. `organizations → clinics` is the organization/location hierarchy; `doctor_locations` represents local professional affiliations. Verified request-scoped access resolves organization and location memberships. The location selector supports memberships across organizations. PostgreSQL remains the source of truth, with no patient/appointment database in browser storage. Existing scheduling APIs remain the boundary for future voice integrations and desktop wrappers.

## 2. Database tables created

Added `organization_members`, `organization_settings`, `onboarding_drafts`, `organization_invites`, `patient_notes`, and `privacy_requests`. Extended organizations with legal/contact/branding, completion, country/timezone/currency, plan/status and 30-day trial fields; locations with city/county/postal code; doctors with calendar color; patients with optional CNP and creator attribution. Added a private `voxa-branding` bucket. Existing appointments, resource relations, history, documents, results, communications and audit tables are reused.

All schema/function/policy changes are forward migrations 023–027. Previously applied migrations remain unchanged. Existing organizations are marked configured; new ones require setup. The optional development seed explicitly marks its fictional organizations configured.

## 3. Authentication flow

Email registration collects name and a matching password of at least 12 characters through Supabase Auth. Email confirmation and password recovery use PKCE callbacks with allowlisted local destinations and canonical `APP_ORIGIN`. Existing username login continues to work. Password updates require a verified session and request global sign-out. Cookies are HttpOnly, SameSite=Lax and Secure in production; authenticated responses are not publicly cached. Patient portal identities and staff memberships stay separate.

## 4. Onboarding flow

Eight steps: clinic identity, locations, hours, services, doctors/assignments, optional cabinets, optional team, final review. Navigation/manual saving persists bounded PostgreSQL drafts with optimistic revision checks. Refresh resumes the saved step. Finalization validates all tenant references and creates resources, relations and schedules atomically; failure rolls back materialization. Initial doctor/cabinet schedules follow the location and are editable through existing availability tools. Cabinets start optional for services. Completion preserves one-time invitation links before dashboard navigation.

## 5. RLS and tenant isolation

RLS, current membership/permission checks and composite foreign keys protect location data. Organization memberships are a serialized projection of location grants, never an editable JWT claim. Drafts and organization identity require ownership. Doctors' schedule, notes, documents, results, versions, file paths and credentials are restricted to their actual professional workflow. Registered medical originals cannot be overwritten or casually deleted. Portal access remains limited to linked patients, explicitly visible documents and released results. Tenant object IDs supplied in crafted requests are independently checked in PostgreSQL.

## 6. Roles implemented

| Role | Scope |
| --- | --- |
| OWNER | Organization administration and full permissions in assigned locations; last-owner removal is guarded |
| ADMIN | Administration within assigned locations; no owner-only organization/privacy access |
| RECEPTION | Patient registry, appointments, documents and permitted reception workflows |
| DOCTOR | Own professional affiliations, appointments/patient workflow, notes and medical results |
| ASSISTANT | Existing restricted read permissions preserved |

`role_permissions` remains the central authority. Invitation roles are ADMIN/RECEPTION/DOCTOR; ownership changes use the existing protected membership workflow. Link the DOCTOR account to its professional affiliation from the doctor profile.

## 7. Pages connected to the database

Dashboard, calendar/scheduling, patients, doctors, services, cabinets/equipment, availability, results, private documents, patient portal, communications, reports, preferences and audit retain their existing real database workflows. Added database-backed setup, invitations, organization identity, personal doctor schedule, clinical patient notes, owner patient export and reviewed privacy requests. Location creation now persists every submitted location field atomically. Shared installation-specific UI text was removed, and result statuses have Romanian labels.

Optional CNP is available only in the authorized patient profile and owner export. Paginated lists, search, calendar, doctor workflow projection and audit metadata omit its value. Format validation checks 13 digits; it does not verify identity authenticity.

## 8. Security measures

Server and database validation, fixed function search paths, explicit function/column grants, immutable tenant identity, ownership guards, transactional scheduling and optimistic revisions complement RLS. Supabase Auth limits and database invitation limits are applied. Invitation tokens use 256 bits of randomness; only SHA-256 hashes are stored. Acceptance checks verified matching email, expiry, replay, revocation and the inviter's current authority. Safe errors avoid clinical content in UI/logs. Service-role credentials remain server-only.

Medical/branding files stay private. Downloads require authorization and 60-second signed URLs. Uploaded content headers/MIME and size are checked; interface uploads allow a combined maximum of 3 MB per form with a 4 MB Server Actions limit. Larger legacy bucket caps preserve existing objects. No medical/legal certification is claimed.

## 9. Tests added

`saas-model.test.ts`, `saas-lifecycle.test.ts`, and `saas-security.test.ts` add 23 database/domain cases to the baseline 121. They execute migrations and role contexts against PostgreSQL/PGlite, including actual Storage RLS policies on the test storage schema. Coverage includes fresh organizations/trials, saved setup/revisions/rollback, real resources and appointment rescheduling, two newly created organizations, crafted reads/writes, owner settings, invitations, clinician restrictions, file path spoofing, immutable registered originals, privacy/export and CNP omission/constraints.

Two new browser cases cover registration, login, full/resumable setup, invitation links, patient creation, a 10:00 appointment, refresh/logout/login persistence and recovery entry protection. Expanded direct URL tests cover owner settings/privacy and invalid IDs. Browser responsiveness checks include 1920/1440/1024/768/390px for setup and additional narrow widths for existing workflows. The new acceptance workflow asserts no browser page errors.

## 10. Verification results

Final checks: `npm run lint` and `npm run typecheck` pass; `npm test` passes 144 tests in 16 suites; `npm run test:e2e` passes 35 browser tests. `npm run build` also passes on the final implementation revision. The browser Auth service is a test protocol fixture backed by real migrated SQL/RLS; it confirms test accounts locally without delivering SMTP email. Storage policies are tested, but the Supabase Storage HTTP service is not emulated. PGlite uses one connection; a hosted multi-connection load test is still required.

The development browser logs also emitted a Next.js stream-cancellation error during navigation in an existing public-booking test. The test passed and the new acceptance workflow reported no browser errors. A hosted production smoke test must still inspect server logs; a passing build is not evidence that live operational logs are clean.

## 11. Environment variables

Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` alternative), plus canonical `APP_ORIGIN` (`http://localhost:3000` locally, HTTPS production).

Existing integrations also require server-only `SUPABASE_SERVICE_ROLE_KEY` for portal provisioning/notification workers, `BOOKING_RATE_LIMIT_SALT`, `CONFIRMATION_TOKEN_SECRET`, and `CRON_SECRET`. Set `BOOKING_EMBED_ORIGINS` only for approved embedding sites. Use `NOTIFICATION_PROVIDER=development` until actual delivery is configured; production uses `webhook`, `NOTIFICATION_PROVIDER_URL`, and `NOTIFICATION_PROVIDER_TOKEN`. See `.env.example`. No actual secret values were committed or placed in the report.

## 12. Supabase setup you must perform

Create separate staging/production projects, review the region and backup plan, and apply all migrations in order without seeds. Configure email signup, email confirmation, SMTP, Site URL and the exact production callback redirect. Review Auth/password/rate-limit policy. Confirm private schema is not exposed, tenant RLS is enabled, and medical/branding buckets are private with policies installed. Configure the notification scheduler only after selecting a real delivery provider. Test with a staging clinic and two independently verified staff accounts before real patient admission.

Existing organizations are intentionally backfilled as configured; review their identity/contact and resource configuration rather than forcing destructive re-onboarding. For real first-time clinics, use registration and the wizard. Database type contracts were updated and typechecked; Supabase CLI type generation was not executed here. Generate a comparison file after local Supabase is available, as described in README.

## 13. External accounts/providers

Hosted Supabase, production SMTP, hosting/custom domain/HTTPS, notification delivery provider, monitoring and suitable backup/restore facilities require external configuration. Staff invitation links work through manual delivery; automatic invitation emails are not implemented or falsely advertised. Payment integration, billing enforcement, platform super-admin UI and doctor photos are not implemented. They are not required to run the local clinic acceptance workflow.

## 14. Remaining production risks/processes

Run real hosted verification/recovery/session revocation, file uploads/downloads/signed URL expiry, revoked-user requests and cross-connection scheduling tests. Establish privacy/legal documents, DPA/subprocessor review, retention rules, access reviews, breach procedures and staff training. Patient erasure/anonymization is a recorded review/attestation process requiring an authorized operator; it does not automatically scrub medical free text, PDFs, outboxes or backups. Backup Storage objects separately from PostgreSQL metadata and rehearse restore. Review default clinical schedules, service duration and cabinet requirements with the clinic. Malware scanning and automated retention processing are not part of this implementation. Trial expiry does not lock users out.

## 15. Exact files and migrations

The complete manifest follows this report's final results. Paths are relative to the repository root; existing files not listed were reused without modification. No dependency/stack replacement or production database reset was performed.

## 16. Exact local/deployment commands

Local PowerShell (Docker and Supabase CLI access required):

```powershell
npm ci
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
npx supabase start
npx supabase db reset
npx supabase status
# Fill .env.local from local status; keep it untracked.
npm run dev
```

`db reset` is local/destructive: it rebuilds the local database and applies the configured fictional development seeds. Do not run it against a real clinic. The Clinica Maria and additional appointment seed scripts remain optional development-only operations; no seed is used in production.

Verification:

```powershell
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Browser tests use installed Edge on Windows. On systems without the configured browser, install the test browser with `npx playwright install chromium` and follow `playwright.config.ts`.

Hosted staging first (replace the project reference and review environment-specific Auth settings):

```powershell
npx supabase login
npx supabase link --project-ref YOUR_STAGING_PROJECT_REF
npx supabase db push
# Adjust Site URL, redirects and SMTP before applying configuration.
npx supabase config push
```

Deploy using the existing Next.js hosting configuration after the checklist and staging validation. Never add `--include-seed` for production. Scheduler commands and secrets are documented in `docs/NOTIFICATION_SCHEDULER.md`.

## 17. Acceptance verdict

**Local implementation acceptance passes:** the browser exercises the full new-clinic/patient/appointment persistence sequence; migrated SQL tests verify isolation of Clinica B, forbidden owner settings and restricted doctor access. Production compilation is checked separately in the final results below.

**Hosted acceptance is not yet verified.** Real Supabase email confirmation/recovery, SMTP, Storage HTTP, multi-connection concurrency and live deployment were not tested. Configure staging and execute `PRODUCTION_CHECKLIST.md` before giving the first real clinic access with patient data.

## Complete changed-file manifest

### New files

- `PRODUCTION_CHECKLIST.md`
- `docs/PRIVACY_OPERATIONS.md`
- `docs/SAAS_IMPLEMENTATION_PLAN.md`
- `docs/SAAS_IMPLEMENTATION_REPORT.md`
- `src/app/api/clinics/[clinicId]/patients/[patientId]/export/route.ts`
- `src/app/clinics/[clinicId]/clinical-patients/[id]/page.tsx`
- `src/app/clinics/[clinicId]/my-schedule/page.tsx`
- `src/app/clinics/[clinicId]/settings/privacy/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/forgot-password/page.tsx`
- `src/app/invitations/[token]/page.tsx`
- `src/app/register/page.tsx`
- `src/app/reset-password/page.tsx`
- `src/features/auth/account-actions.ts`
- `src/features/auth/account-model.ts`
- `src/features/auth/account-page.tsx`
- `src/features/onboarding/actions.ts`
- `src/features/onboarding/model.ts`
- `src/features/onboarding/wizard.tsx`
- `src/features/organizations/access.ts`
- `src/features/organizations/invitation-actions.ts`
- `src/features/organizations/invitation-model.ts`
- `src/features/organizations/team-invitations.tsx`
- `src/features/privacy/actions.ts`
- `src/features/privacy/patient-notes.tsx`
- `src/features/privacy/patient-privacy.tsx`
- `src/lib/app-origin.ts`
- `supabase/migrations/202610020023_saas_organizations.sql`
- `supabase/migrations/202610020024_onboarding_finalize.sql`
- `supabase/migrations/202610020025_privacy_and_storage.sql`
- `supabase/migrations/202610020026_organization_identity.sql`
- `supabase/migrations/202610020027_patient_identifiers.sql`
- `tests/browser/saas-onboarding.spec.ts`
- `tests/saas-lifecycle.test.ts`
- `tests/saas-model.test.ts`
- `tests/saas-security.test.ts`
- `tests/support/setup.ts`

### Modified files

- `.env.example`
- `README.md`
- `docs/ARCHITECTURE.md`
- `next.config.ts`
- `playwright.config.ts`
- `src/app/auth/callback/route.ts`
- `src/app/clinics/[clinicId]/layout.tsx`
- `src/app/clinics/[clinicId]/page.tsx`
- `src/app/clinics/[clinicId]/results/[id]/page.tsx`
- `src/app/clinics/[clinicId]/results/page.tsx`
- `src/app/clinics/[clinicId]/settings/layout.tsx`
- `src/app/clinics/[clinicId]/settings/organization/page.tsx`
- `src/app/clinics/[clinicId]/settings/page.tsx`
- `src/app/clinics/[clinicId]/team/page.tsx`
- `src/app/globals.css`
- `src/app/login/page.tsx`
- `src/app/onboarding/page.tsx`
- `src/app/page.tsx`
- `src/components/shell.tsx`
- `src/components/ui/action-form.tsx`
- `src/features/auth/access.ts`
- `src/features/auth/actions.ts`
- `src/features/auth/login-form.tsx`
- `src/features/calendar/calendar-workspace.tsx`
- `src/features/calendar/data.ts`
- `src/features/calendar/model.ts`
- `src/features/core-clinic/create-panel.tsx`
- `src/features/core-clinic/detail.tsx`
- `src/features/core-clinic/editor.tsx`
- `src/features/core-clinic/model.ts`
- `src/features/core-clinic/validation.ts`
- `src/features/credentials/actions.ts`
- `src/features/documents/actions.ts`
- `src/features/documents/patient-documents.tsx`
- `src/features/patient-portal/actions.ts`
- `src/features/results/model.ts`
- `src/features/results/patient-results.tsx`
- `src/features/settings/actions.ts`
- `src/features/settings/clinic-fields.tsx`
- `src/features/settings/settings-nav.tsx`
- `src/features/settings/whatsapp-template-field.tsx`
- `src/lib/medical-storage.ts`
- `src/lib/supabase/config.ts`
- `src/lib/validation.ts`
- `src/proxy.ts`
- `src/types/database.ts`
- `supabase/config.toml`
- `supabase/seed.sql`
- `tests/browser/core-clinic.spec.ts`
- `tests/browser/foundation.spec.ts`
- `tests/fixtures/supabase.mjs`
- `tests/support/database.ts`
