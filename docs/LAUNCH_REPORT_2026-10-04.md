# Release evidence — 4 October 2026

The broken authenticated dashboard entry originated from schema drift: production matched migration 021 while the application needed later organization/onboarding/subscription schema. After an encrypted snapshot, forward migrations 022–033 were applied, preserving old migration IDs and existing records. Both backends match 1,379 catalog checks. Existing sessions now have a safe POST account-switch escape at public Auth entry.

Authorized production Zoho configuration was saved/read back in Supabase Auth and private Vercel configuration; TLS authentication passes. Application invitations use durable SMTP acknowledgement guards. Patient notification delivery is disabled. Production inbox acceptance is still an owner gate; SMTP handshake is not inbox evidence.

Added readiness, scrubbed request-error references/optional alerts, support/help, encrypted operator snapshots, a synthetic restore drill, forward-release checks and hosted concurrency test. Company documents remain drafts; Vercel URL retained; Stripe deferred.

## Validation

- 187 domain/database/email tests in 25 files pass; 46 local browser cases pass.
- 17 hosted browser cases pass, one genuine-expiry fixture absent/skipped this round. Prior expiry/revocation evidence remains in HOSTED_STAGING_REPORT.md.
- Hosted smoke, bidirectional tenant/Storage isolation, roles/invitations and exact schema equality pass.
- Twelve independent backend clients contend for one synthetic slot: one success, eleven explicit conflicts, winner cancelled normally. Not a capacity benchmark.
- Production encrypted pre-upgrade snapshot decrypt-verified. Synthetic local restore matches 48 public application tables and verifies two private file hashes. Full hosted Auth/Storage/PITR restore remains open.
- Lint, typecheck, local and hosted staging optimized builds pass; mobile help/readiness checks pass.
- Runtime dependency audit: zero known advisories; five high dev-tool advisories tracked in LAUNCH_OPERATIONS.md.

Staging: `dpl_5T4Pxg8dcCHnEuWUEasjktvtdQ8j`, protected Preview `voxa-os-staging-6aczmqjy5-voxa6.vercel.app`, stable alias retained. Temporary staging automation access is revoked after verification; credentials/bearer links are excluded from this report.

Production optimized build and deployment passed: `dpl_YnZ9KCxw74FdRpwTKRdizfRJDiyc`, aliased to https://voxa-os.vercel.app. This is a deployment for controlled product testing; the business gates below remain open.

Open business gates: production inbox check, commercial Vercel plan (current Hobby), off-device scheduled backups/full hosted restore, independent uptime monitor/responder, firm identity and approved agreements/retention, clinic pilot. No paid upgrade or real medical-data launch is claimed.

Procedures: LAUNCH_OPERATIONS.md. Drafts: LEGAL_DRAFTS_RO.md. Current gates: ../PRODUCTION_CHECKLIST.md.
