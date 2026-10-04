# Voxa — release readiness, 4 October 2026

Current release supports controlled product testing. Commercial and real medical-data launch require the open gates below. Stripe is deferred; the existing trial/license workflow remains active.

## Completed and evidenced

- [x] Separate staging/production Supabase projects; staging tools reject production.
- [x] Production baseline matched migration 021; forward migrations through 035 applied without reset, seed or historical-ID rewrite. Both environments match 1,430 current catalog checks.
- [x] Public login/register work; an existing session can continue or switch accounts using POST. Signup preserves invitation context. Dashboard requires a valid session.
- [x] Authorized production transactional SMTP, verified STARTTLS, mandatory email confirmation, 12-character new-password policy and bounded callback URLs. Brevo replaced the earlier Zoho setup; staff invitation SMTP configured and patient delivery disabled.
- [x] Legacy production signup prohibition found and removed with explicit authorization; normal controlled signup succeeds with email confirmation still required.
- [x] Controlled production confirmation received/completed; confirmed account authenticates normally and a new account reaches organization setup. Owner completed password recovery from the received email and confirmed normal login with the new password.
- [x] Durable email acknowledgement ledger prevents automatic resend after accepted/uncertain delivery. SMTP acceptance does not prove inbox delivery.
- [x] Database readiness at /api/health, scrubbed request-error references and optional operator SMTP alerts.
- [x] Credential-free GitHub production readiness workflow active for approximately 15-minute checks of health, Auth forms, anonymous dashboard redirection and staging-route isolation. All six checks pass locally; actual scheduled run [37214627441](https://github.com/hypeskall/voxa-os/actions/runs/37214627441) also passed. Earlier setup evidence is in docs/SETUP_REPORT_2026-10-04.md.
- [x] Encrypted production pre-upgrade snapshot captured/decrypt-verified. Synthetic local restore matches 48 application tables exactly; two Storage files pass integrity checks.
- [x] New full synthetic clinic pilot, A/B tenant/Storage, roles/invitations and genuine expiry checks pass. Hosted browsers: 19 passed with no skips, plus the real MFA test (20 distinct tests). Evidence: docs/ACCEPTANCE_1_4_2026-10-04.md.
- [x] Twelve independent appointment clients: one success, eleven explicit conflicts; winner cancelled normally. This is a race test, not capacity certification.
- [x] [Final implementation quality run 37214838720](https://github.com/hypeskall/voxa-os/actions/runs/37214838720) passed all 222 domain/database/email/operator tests, lint, typecheck, 46 local browser tests and optimized build. Hosted responsive checks pass at 1440/1024/390px.
- [x] Optional TOTP enrollment, login verification, verified removal and MFA enforcement for stale sessions/private tables/RPCs/Storage/download APIs. Recovery cannot bypass the app's MFA gate. Owner personal enrollment remains an owner action.
- [x] Complete isolated Auth/application/private/Storage restoration passed: 77 data tables matched, two files recovered and normal recovered account login/tenant isolation passed. Provider migration metadata retained for the disposable runtime.
- [x] Support contact and /help guide configured. Company details not invented; existing Vercel URL retained.

## Open owner/clinic gates

- [x] Replaced ordinary Zoho Mail for production transactional email with Brevo Free. Subdomain DNS/authentication, verified sender, dedicated SMTP key and explicitly approved Supabase/Vercel settings are configured and deployed. The owner confirmed recovery, staff-invitation and deliberate operator-alert Inbox delivery. Auth pilot quota is 10/hour; provider capacity still needs review before growth. Procedure: docs/TRANSACTIONAL_EMAIL_SETUP.md.
- [ ] Select commercial hosting. Current Vercel team is Hobby; its [fair-use policy](https://vercel.com/docs/limits/fair-use-guidelines) requires Pro/Enterprise for commercial usage. No paid upgrade was made.
- [x] Private EU R2 destination, approved encrypted staging/production uploads, separate private daily GitHub runner and successful manual cloud backup with download integrity verification. Owner confirmed controlled failure-alert receipt and separate recovery-key custody. Details: docs/PRIVATE_BACKUP_RUNNER.md.
- [ ] Complete first actual scheduled-trigger acceptance and agree recovery objectives/retention. Full isolated Auth/private/Storage restore is verified. Production has no native backups/PITR configured; logical snapshots do not replace physical/PITR backups. Current evidence: docs/ACCEPTANCE_1_4_2026-10-04.md.
- [ ] Assign an incident responder and provision dedicated uptime monitoring if guaranteed intervals are required. The owner already confirmed the deliberate GitHub failure email and Brevo operator-alert Inbox delivery. GitHub readiness checks are best effort; they can be delayed and public-repository inactivity can disable them.
- [ ] Fill firm/CUI/address and approve terms, privacy notice, DPA, processor list and retention. Drafts: docs/LEGAL_DRAFTS_RO.md. Footer dialogs are product summaries, not approved agreements.
- [ ] Agree medical-original retention/deletion and identity checks. Archiving and privacy review attestations do not physically erase data/files.
- [ ] Enroll the owner's personal MFA, finalize clinic ownership/operations and review optional leaked-password controls. Enforced app MFA, staff/doctor permissions and the synthetic clinic pilot are already verified.
- [ ] Verify provider/inbox, consent/content and scheduler before patient delivery. SMTP supports email only; SMS needs another provider. Delivery flag stays false.
- [ ] Decide business costs, support commitments and billing/tax treatment; integrate Stripe at the requested final stage.

See docs/LAUNCH_OPERATIONS.md and docs/LAUNCH_REPORT_2026-10-04.md for procedures and evidence.
