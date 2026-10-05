# Hosted staging execution guide

**Current release note, 5 October:** staging now has 40 migrations and 1,460 catalog checks; production has the corresponding verified schema while preserving historical migration IDs. See [current audit](DEEP_AUDIT_2026-10-05.md) and [Stripe live](STRIPE_LIVE.md). The 31-migration inventory and original acceptance observations below are historical. Staging still uses development notifications and sandbox billing; that is distinct from active production email/live billing.

On 3 October 2026 the dedicated infrastructure, all 31 migrations and 1,254 catalog checks passed. Both owners are confirmed, both saved passwords work, and both clinics have real synthetic fixtures. Hosted onboarding, appointments, WhatsApp preparation, bidirectional database/Storage isolation, orphan recovery, invitations, role boundaries and genuine session expiry passed. A fresh recovery email reached the new-password form through the explicit confirmation step. The owner completed the final A rotation. The protected Preview includes the login hydration safeguard. See `HOSTED_STAGING_REPORT.md` for deployment, 16 hosted checks, 39 local browser checks and trial scope limits; this guide alone is not a production-readiness claim.

## Access required from the owner

The browser dashboards and Vercel CLI are signed in to the intended accounts. The dedicated Supabase project is `wlnrfjrjkyywqyvsngps` (`voxa-os-staging`, Frankfurt, PostgreSQL 17.11); Vercel project `voxa6/voxa-os-staging` is `prj_1zHqovTMxeOrQB3FTDCFB5hVHkNs`. Its stable acceptance origin is `https://voxa-os-staging-voxa6.vercel.app`. Production `fibcbsdattoqiyizzeda` and `https://voxa-os.vercel.app` must never receive staging changes.

Minimal owner steps:

1. Account access is complete. The owner saved an organization-scoped Supabase access token locally and authorized the correct Vercel login. A token scoped only to the production project returned `403 Forbidden` for staging creation and was replaced. Keep operator credentials in ignored local files.
2. Zoho SMTP setup is complete: `smtp.zoho.eu`, port 587, authentication accepted over verified STARTTLS. The owner generated and saved the application-specific password locally. Staging Supabase Auth accepted the SMTP configuration and all four custom templates. `STAGING_SMTP_*` remain local operator values, excluded from the Vercel uploader. Both real emails were confirmed; actual password updates and subsequent normal password logins were observed for both accounts.
3. Both controlled accounts are registered, confirmed and configured. Clinic B has its separate doctor, patient, appointment and private PDF. A hosted test uncovered a pre-hydration login form submitting through native GET. The form now uses POST and disables credentials until hydration. The owner completed the required A rotation and updated ignored `.staging-actors.local.json`; both current passwords authenticate. The local failed-test artifact was removed. The second password was not observed in a credential URL. No further staging account setup is required. Vercel protection remains active: use the authorized in-app browser, or sign in to Vercel in Brave before opening recovery links.

Once access exists, project creation, secret generation, migration application, preview configuration, deployment and synthetic acceptance can continue autonomously. The owner does not need to perform those application steps individually. If creating a second free Supabase project hits an account quota, the owner must free a slot or approve an appropriate plan; do not delete an existing project or purchase a plan automatically.

## Isolated Supabase project

Create `voxa-os-staging` in organization `xsnxpmbrudzzbgihrwkf`, with its own database password. Use Europe/Frankfurt (`eu-central-1`) for staging after confirming the available region. Enable the Data API. The migrations explicitly grant access and enable RLS; do not add broad default table policies. Never copy production patients, users, Storage objects or demo seeds.

The official CLI creation command is:

If running this manually, first run `npx --yes supabase@2.119.0 login`. The CLI does not automatically read the operator token from `.env.staging.local`; an agent using the prepared local token supplies it only in the child process environment.

```powershell
npx --yes supabase@2.119.0 projects create voxa-os-staging --org-id xsnxpmbrudzzbgihrwkf --region eu-central-1
```

If it requests a password, enter a newly generated staging password interactively. Alternatively create the project in the dashboard and save its reference and database password into `.env.staging.local`. The password is needed by migration tooling, not by the application. Never put a password in committed command examples.

Fill `.env.staging.local` from the project's API Keys page: exact URL, publishable key (or legacy anon key) and server secret/service-role key. Generate independent random values of at least 32 characters for booking salt, confirmation signing and cron authorization. Reserve a separate stable HTTPS staging alias and set `APP_ORIGIN` to its origin with no trailing slash. Set `APP_ENVIRONMENT=staging` and `STAGING_SUPABASE_PROJECT_REF` to the new reference.

```powershell
npm run staging:check
npm run staging:migrate
npm run staging:migrate -- --apply
```

The first migration command is a dry run. The apply wrapper uses an explicit project reference, skips Vault updates, never includes seeds, and runs hosted schema inspection afterward. It requires `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` in the ignored staging file. It never loads `.env.local` or `.env.production.local` as credentials.

The current repository has migrations **001–031**, already applied and verified on the dedicated staging project. Migration 028 adds an operator-only failed-upload cleanup queue; 029 corrects only the exact old WhatsApp default; 030 restores notes-history updates; 031 records WhatsApp opening in patient communications without claiming delivery. Existing 023–027 were inspected and preserved. Do not use `db reset`, `--include-seed`, `config push`, or migration-history repair to force a failed hosted deployment into a passing state.

```powershell
npx --yes supabase@2.119.0 migration list --project-ref YOUR_STAGING_REFERENCE
npm run staging:schema
```

`staging:schema` reads the Management API and checks all expected tables/columns/defaults, foreign keys/check constraints, indexes, tenant policies, triggers, function bodies/security-definer settings/anonymous execution, private buckets and exact migration history. The expected inventory is regenerated from unmodified migrations in an isolated local PostgreSQL engine; no fixture patients/users are inserted. It also rejects disabled RLS, additional tenant policies and unexpected anonymous security-definer functions. Catalog differences fail explicitly; investigate them rather than disabling checks. The SQL inventory is `scripts/staging-schema.sql`, also usable in the staging SQL Editor. Structural equivalence does not replace behavioral hosted RLS probes.

## Vercel Preview

Use a **new project** `voxa-os-staging` under team `voxa6`. Keep the existing `voxa-os` project untouched. Node 24, Next.js preset, `npm ci`, `npm run build`. No Git push is needed to deploy current local changes through the CLI.

```powershell
npx --yes vercel@62.2.0 project create voxa-os-staging --scope voxa6
npm run staging:vercel-env
npx --yes vercel@62.2.0 deploy --project voxa-os-staging --scope voxa6 --target preview --yes
```

The environment uploader whitelists application variables and sends secret values through stdin; it targets only the dedicated project's Preview environment. Supabase personal access tokens and database passwords are excluded. On subsequent changes, update the matching Preview variables (the CLI supports `vercel env update NAME preview --project voxa-os-staging --scope voxa6`). Do not upload them to Production or use `--prod`.

Assign the reviewed staging alias to the returned preview URL:

```powershell
npx --yes vercel@62.2.0 alias set RETURNED_PREVIEW_URL YOUR_STAGING_ALIAS --scope voxa6
```

The alias must exactly match `APP_ORIGIN` and be separate from every production domain. If it is unavailable, choose another dedicated alias, update Preview `APP_ORIGIN` and Auth URLs, then redeploy. Keep Preview protection enabled; use an authorized Vercel session for browser checks or the dedicated staging project's Protection Bypass for Automation secret. The owner can obtain this in the staging project's Settings > Deployment Protection and save it locally as `STAGING_PREVIEW_BYPASS_SECRET`. Probes send it only in a header to the exact staging origin; browser QA intercepts only that origin and does not attach it to Supabase or external requests. This secret is excluded from the Vercel environment upload. Do not weaken protection just to make tests pass. Without authorized access, a Vercel login page is a failed acceptance result. See [Vercel's automation protection guidance](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation).

Vercel classified the first deployment of this new staging project as Production despite the requested Preview target; no Production variables were uploaded. Subsequent acceptance deployments are Preview, confirmed by inspection, and the stable alias points to the verified Preview. The bootstrap URL is not the acceptance environment. The existing production project remains untouched. Preview feedback is disabled on the staging project because its injected `vercel.live` script conflicts with the application's CSP; a rebuild was required. CSP was not relaxed. Tests use the bypass header on every staging request, without the cookie-setting header that causes an initial 307 redirect.

Public checks can run before actor registration:

```powershell
npx playwright test --config playwright.hosted.config.ts tests/hosted-browser/public.spec.ts
```

These five checks do not establish confirmed-user, onboarding or tenant-isolation acceptance. Full `test:hosted` still requires the real actor file. Next.js streamed protected pages can return HTTP 200 with a bounded `__next-page-redirect` meta tag; smoke checks validate its actual same-origin login destination and browser tests verify navigation.

`.vercelignore` excludes all local env files, staging actor credentials and demo seeds. Build-time and runtime assertions reject the known production Supabase reference and production domain when `APP_ENVIRONMENT=staging`. `/api/staging/status` returns only the public staging reference/origin and exists only in staging. Probes verify this marker before any authenticated synthetic writes.

## Supabase Auth and SMTP

On the **staging** project, set Authentication > URL Configuration:

- Site URL: the exact staging `APP_ORIGIN`.
- Redirect URLs: `https://YOUR_STAGING_ALIAS/auth/callback` and `https://YOUR_STAGING_ALIAS/auth/callback?next=**` for the application's bounded destinations. Do not allow arbitrary external hosts or a broad `https://**` wildcard.
- Enable email/password signup and email confirmation. Use at least 12-character passwords; review rate limits for the planned test accounts. Keep anonymous sign-ins disabled.

The server sets canonical callback destinations for registration, recovery and portal emails. `/auth/callback` handles PKCE `code` links and validated email `token_hash` links. Recovery email GETs, including legacy callback URLs, render `/auth/recovery` without consuming the OTP. Clicking **Continuă** submits a server action that verifies only the recovery type and redirects to `/reset-password`. This prevents a GET-only email scanner from consuming the link. Recovery requests lock after success until an explicit new request; another request replaces the earlier link. Email OTP Expiration is 3,600 seconds, independently verified in the staging Management API; Supabase enforces that limit for recovery links. Other validated callback types remain email/signup/invite/magiclink; arbitrary OTP types and external redirects are rejected. Callback responses are not cached; all application pages use `Referrer-Policy: no-referrer` to avoid sharing invitation tokens in navigation headers.

Supabase's default sender currently restricts delivery to organization team-member addresses and about **two messages per hour**. It is useful for a limited team-inbox test, but cannot support the complete two-clinic/staff/recovery scenario with arbitrary recipients. Do not add staff to the Supabase infrastructure team just to bypass this limitation, auto-confirm users, or claim delivery after generating an admin link. See [Supabase SMTP restrictions](https://supabase.com/docs/guides/auth/auth-smtp).

For the complete scenario, use an SMTP provider account with a verified sender/domain (for example a provider that supports standard SMTP). The owner must authorize the account/domain and publish the provider's required SPF/DKIM DNS records. Configure Authentication > Email > SMTP Settings with sender name `Voxa-OS staging`, a provider-authorized sender address, host, TLS port, username and SMTP password. Keep provider click tracking disabled. SMTP credentials belong in Supabase's SMTP configuration, **not** in `NEXT_PUBLIC_*` or Vercel application variables. Verify provider logs and receipt in each controlled test inbox.

Copy these HTML files into staging Email Templates:

The Management API initially rejected template modification on the free staging project while it used the default sender. After the owner configured Zoho SMTP, all four templates were applied and their saved contents verified. Basic Auth URL/password/confirmation settings are saved; no auto-confirm bypass was enabled. The staging SMTP rate limit is 20 emails/hour for controlled acceptance only, subject to Zoho's own quotas.

| Supabase template | Repository file |
| --- | --- |
| Confirm signup | `supabase/templates/staging-confirm-signup.html` |
| Reset password | `supabase/templates/staging-recovery.html` |
| Magic link | `supabase/templates/staging-magic-link.html` |
| Invite user (patient portal Auth invite) | `supabase/templates/staging-auth-invite.html` |

Signup, magic-link and portal invitation templates append validated OTP fields to the application's bounded `RedirectTo`. Recovery uses `SiteURL/auth/recovery` and the explicit confirmation step. Preserve the templates and handler together. Existing application PKCE links remain supported. The saved recovery template was verified in Supabase and a real received email reached the new-password form. GET-prefetch and single-request locking regressions pass locally. See [Supabase email template guidance](https://supabase.com/docs/guides/auth/auth-email-templates).

Staff invitations are separate from Supabase Auth's portal invite template. `STAFF_INVITATION_PROVIDER=manual` is an explicitly labeled **staging fallback**. The server returns a one-time copyable link, stored in the database only as a hash, with seven-day expiry. It does not pretend that email was sent.

Optional automatic staff delivery uses `STAFF_INVITATION_PROVIDER=webhook`, server-only `STAFF_INVITATION_PROVIDER_URL` and `STAFF_INVITATION_PROVIDER_TOKEN`. The adapter receives an authenticated HTTPS POST with an `Idempotency-Key` and JSON `{kind:"staff_invitation",to,invitationUrl,expiresInDays:7}`. The receiver must send a transactional Romanian invitation, preserve the secure link, honor idempotency, and redact links/addresses from logs. A 2xx means provider acceptance, not inbox delivery; timeouts/errors return manual fallback without fabricating a successful send. Onboarding creates invites atomically before attempting delivery. No email provider has been configured or tested externally in this task.

Keep the separate patient notification worker/scheduler disabled during acceptance. `NOTIFICATION_PROVIDER=development` is a synthetic adapter and does not prove delivery. WhatsApp is a manual conversation link; its communication log records preparation/opening, not confirmed receipt.

## Hosted acceptance sequence

Use synthetic records only. Register through the real hosted UI and confirm each email from its real inbox; do not use admin auto-confirm or generated links as a substitute. Record outcomes and timestamps without storing passwords, bearer links, CNP, notes or medical contents in artifacts.

1. Clinic A owner: register, verify, log in, land on onboarding. Save/reload and finish all eight steps for **Clinica Test Voxa**, Oradea, Monday–Friday 08:00–18:00, Consultație 200 RON/30 min, Control 100 RON/15 min, Ana Popescu, Mihai Ionescu, Cabinet 1. Confirm dashboard, refresh, logout/login and persisted resources. Exercise onboarding at 1440/1024/390px before completion.
2. Create Ion Popescu and a future working-day 10:00 Consultație with Ana Popescu. Confirm calendar, appointments list, patient history and the linked doctor's own schedule. Edit, reschedule, confirm and complete it; use additional appointments for cancelled/no-show. Check status history after refresh/logout/login. Do not run real patient contact delivery.
3. Use a controlled Romanian-format test phone. Inspect the WhatsApp URL and decoded text for patient, actual clinic, doctor, service, date/time. Verify country normalization (`07...` and `+407...`), URL encoding and communication history. Opening WhatsApp is sufficient; do not send a real message or claim delivery.
4. Create ADMIN/RECEPTION/DOCTOR invites, copy/send via the configured boundary, register/verify or log in as the target, accept once. Test wrong confirmed email, random token, replay, revocation, seven-day expiry and inviter permission revocation. For an expired disposable staging invitation, an operator may advance only its `expires_at` in the staging database; never change the production clock/config. Link the DOCTOR account to Ana's local professional affiliation.
5. Check each role's navigation **and** manually entered routes/direct RPCs. OWNER controls organization/privacy/export. ADMIN has clinic management but cannot change owner-only organization identity. RECEPTION cannot manage staff/security/privacy or perform owner mutations. DOCTOR sees only assigned workflows and cannot browse the entire patient/appointment registry, peer medical results or another doctor's credentials. Revocation must remove access immediately on fresh requests.
6. Clinic B: a different confirmed owner and organization **Clinica B**, at least one doctor/patient/appointment and a registered private document. Confirm B sees its own data. Before any shared membership, run A↔B isolation probes and confirm database row counts/data were unaffected by blocked mutations.
7. Copy `docs/staging-actors.example.json` to `.staging-actors.local.json`, fill only controlled credentials and the real IDs/registered private file paths. It is ignored by Git and Vercel. Run the commands below. The script first proves each victim row/object exists with its authorized owner, then attempts other-tenant reads/writes, user enumeration, settings/audit access, downloads/signed URLs and uploads with a normal user session. SQL/PostgREST requests that fail for unrelated reasons are not counted as authorization passes.
8. Invite a controlled existing Clinic B user into one Clinic A location after isolation testing. Verify the location selector exposes exactly granted locations; direct foreign IDs still fail. Current architecture permits multiple organizations through invitations, and resolves context from the route's authorized clinic. A default preference only works if membership remains active. A role in one organization does not grant the same role in another.
9. Auth: invalid credentials, direct logged-out URLs, logout, refresh/persistent cookie flags, recovery email, actual password update, old/new password behavior, expired recovery links, refresh-token revocation/expired sessions, and callback/open-redirect negatives. Password entry/submission and inaccessible inbox checks may require owner handoff; never replace real email verification with fixture behavior.

```powershell
npm run staging:smoke
npm run staging:rls
npm run test:hosted
```

The hosted browser suite starts **no local server and no fixture adapter**. It checks the deployment marker, protected routes, invalid credentials, real session persistence/logout, cross-clinic patient URLs, clinic pages and appointment dialog at 1440/1024/390px. It counts browser exceptions, React/hydration warnings, unexpected HTTP errors and failed network requests. Cancelled navigations are excluded from failed-network counts. Traces/videos/screenshots are disabled to avoid retaining credentials or clinical content. This QA suite does not alone establish complete signup/onboarding/role/invitation/appointment/WhatsApp acceptance; steps above remain required.

## Private files and cleanup recovery

Use both real private buckets: `voxa-medical` and `voxa-branding`. Upload an actual allowed file under 3 MB, verify filename/MIME/size metadata, then download via the application's authorized route (60-second signed URL). Anonymous and other-tenant download/sign/upload requests must fail even with the complete object name. Test declared MIME/header mismatch and the combined signature+stamp size limit.

Registered medical originals cannot be overwritten or casually deleted by staff, including OWNER. This preserves the existing reviewed retention workflow. Physical clinical erasure is a controlled operator process documented in `PRIVACY_OPERATIONS.md`; the application currently has **no ordinary document-delete UI**. Do not claim an upload/download/delete product scenario passed: authorized deletion of a registered document is intentionally unsupported and remains an explicit trial-scope decision.

Upload precedes metadata insertion. If upload fails, the document row is not inserted. If registration fails, compensation attempts to remove the unregistered upload, including uncertain upload failures. If removal fails or returns fewer objects than requested, migration 028 stores a cleanup job through an authenticated RPC that rechecks tenant/path ownership and rejects registered originals. If durable recording also fails, the UI explicitly requests administrator Storage review. Object names never enter application logs/errors.

Operator reconciliation (SQL Editor on staging only):

```sql
select id,bucket_id,object_path,created_at
from public.storage_cleanup_jobs
where resolved_at is null order by created_at;
select public.storage_cleanup_unreferenced('JOB_UUID');
```

The queue and reference check are inaccessible to anon/authenticated users; use an authorized operator/service role. Recheck the object against all current document/result/credential/logo references, pause competing uploads/registration for the affected object during reconciliation, and delete only a confirmed unregistered temporary object through Supabase Storage. Do not delete rows from `storage.objects` directly (that does not delete the actual object). Mark `resolved_at=now()` only after Storage confirms removal or the object is already absent. If it became registered, retain it and resolve the obsolete cleanup request as a no-deletion review. This is manual operator recovery, not an automatic purge worker; no background deletion job was enabled. A DB-row-first physical deletion is not performed by the application, so it does not create the corresponding dangling-object state.

## Environment ownership

| Variables | Where they belong |
| --- | --- |
| `APP_ENVIRONMENT=staging`, `STAGING_SUPABASE_PROJECT_REF`, `APP_ORIGIN` | Staging Vercel Preview + ignored local staging file |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` **or** `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Staging public configuration; anon/publishable is not a server secret |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only staging secret; never public/client code |
| `BOOKING_RATE_LIMIT_SALT`, `CONFIRMATION_TOKEN_SECRET`, `CRON_SECRET` | Independent server-only staging secrets |
| `STAFF_INVITATION_PROVIDER=manual` (or reviewed `webhook` + URL/token) | Vercel server configuration |
| `NOTIFICATION_PROVIDER=development` | Staging only; scheduler disabled; no real patient notification claim |
| `BOOKING_EMBED_ORIGINS` | Optional reviewed HTTPS embedding origins |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `STAGING_VERCEL_PROJECT`, optional `STAGING_PREVIEW_BYPASS_SECRET` | Local operator configuration; never uploaded by the env wrapper |
| SMTP host/port/user/password/sender | Supabase Auth SMTP dashboard, never public/Vercel app variables |

Production still requires a separate reviewed domain/project configuration, real email/notification delivery, backups and Storage recovery rehearsal, monitoring with sensitive-data scrubbing, and clinic retention/access procedures. The existing production project has not received this task's migrations or deployment. Admission of a real clinic requires completion of all hosted acceptance gates and resolution of the explicit document-deletion scope above.
