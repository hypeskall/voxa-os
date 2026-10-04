# Voxa — release readiness, 4 October 2026

Current release supports controlled product testing. Commercial and real medical-data launch require the open gates below. Stripe is deferred; the existing trial/license workflow remains active.

## Completed and evidenced

- [x] Separate staging/production Supabase projects; staging tools reject production.
- [x] Production baseline matched migration 021 (1,059 catalog checks); forward migrations 022–033 applied without reset, seed or historical migration-ID rewrite. Both environments match 1,379 current catalog checks.
- [x] Public login/register work; an existing session can continue or switch accounts using POST. Signup preserves invitation context. Dashboard requires a valid session.
- [x] Authorized production Zoho SMTP, verified STARTTLS, mandatory email confirmation, 12-character new-password policy and bounded callback URLs. Staff invitation SMTP configured; patient delivery disabled.
- [x] Legacy production signup prohibition found and removed with explicit authorization; normal controlled signup succeeds with email confirmation still required.
- [x] Controlled production confirmation received/completed; confirmed account authenticates normally and a new account reaches organization setup. Owner completed password recovery from the received email and confirmed normal login with the new password.
- [x] Durable email acknowledgement ledger prevents automatic resend after accepted/uncertain delivery. SMTP acceptance does not prove inbox delivery.
- [x] Database readiness at /api/health, scrubbed request-error references and optional operator SMTP alerts.
- [x] Credential-free GitHub production readiness workflow active for approximately 15-minute checks of health, Auth forms, anonymous dashboard redirection and staging-route isolation. All six checks pass locally and the first hosted dispatch passed; evidence is in docs/SETUP_REPORT_2026-10-04.md.
- [x] Encrypted production pre-upgrade snapshot captured/decrypt-verified. Synthetic local restore matches 48 application tables exactly; two Storage files pass integrity checks.
- [x] Hosted A/B tenant/Storage and role/invitation checks pass. Hosted browsers: 17 pass, one expiry fixture skipped this round. Prior genuine expiry evidence is in docs/HOSTED_STAGING_REPORT.md.
- [x] Twelve independent appointment clients: one success, eleven explicit conflicts; winner cancelled normally. This is a race test, not capacity certification.
- [x] 187 domain/database/email tests, 46 local browser tests, lint, typecheck and optimized builds pass. Hosted responsive checks at 1440/1024/390px.
- [x] Support contact and /help guide configured. Company details not invented; existing Vercel URL retained.

## Open owner/clinic gates

- [ ] Review the current global Auth email quota of 2/hour against Zoho's plan before public pilot. Controlled confirmation and recovery delivery/login are verified; DKIM selector/alignment still needs provider evidence.
- [ ] Select commercial hosting. Current Vercel team is Hobby; its [fair-use policy](https://vercel.com/docs/limits/fair-use-guidelines) requires Pro/Enterprise for commercial usage. No paid upgrade was made.
- [ ] Approve recurring off-device backups, separate key custody, recovery objectives and full hosted Auth/Storage restore. R2 setup is deferred at the owner's request; no remote transfer or recurring runner is active. Production API currently lists no backups and PITR is disabled; logical snapshots are not physical/PITR backups.
- [ ] Confirm failed-workflow notification preferences/inbox delivery, assign a responder and provision dedicated uptime monitoring if guaranteed intervals are required. GitHub readiness checks are best effort; they can be delayed and public-repository inactivity can disable them.
- [ ] Fill firm/CUI/address and approve terms, privacy notice, DPA, processor list and retention. Drafts: docs/LEGAL_DRAFTS_RO.md. Footer dialogs are product summaries, not approved agreements.
- [ ] Agree medical-original retention/deletion and identity checks. Archiving and privacy review attestations do not physically erase data/files.
- [ ] Review MFA, leaked-password/email-change controls, staff permissions, schedules and ownership handoff; run the clinic pilot with synthetic data until medical-data gates pass.
- [ ] Verify provider/inbox, consent/content and scheduler before patient delivery. SMTP supports email only; SMS needs another provider. Delivery flag stays false.
- [ ] Decide business costs, support commitments and billing/tax treatment; integrate Stripe at the requested final stage.

See docs/LAUNCH_OPERATIONS.md and docs/LAUNCH_REPORT_2026-10-04.md for procedures and evidence.
