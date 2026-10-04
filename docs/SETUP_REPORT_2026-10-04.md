# Operational setup — 4 October 2026

Production remains https://voxa-os.vercel.app. Stripe and patient notification delivery remain deferred. No paid upgrade or hosting migration was performed.

## Configured in this pass

- Added a public GitHub readiness workflow with approximately 15-minute checks, manual dispatch, minimal permissions, pinned official checkout/setup-node actions and no private credentials or artifacts.
- Six checks pass against the actual production site: database health, login, registration, password-recovery form, unauthenticated dashboard redirection and production staging-route isolation. Next.js may redirect a streamed dashboard response through a refresh meta tag; the monitor validates that target rather than treating HTTP 200 alone as successful access.
- Eleven focused tests pass, covering transient retry, database unavailability despite HTTP 200, false Auth pages, exposed dashboards, off-site redirects, streamed redirects and diagnostic suppression. Typecheck/lint passed before publication. The complete hosted quality workflow also passed typecheck, lint, all unit/database tests, browser tests and production build; evidence is below.
- Production SMTP authentication passes with STARTTLS and certificate verification. No email was sent in this check. Auth readback confirms the production origin, confirmation requirement, secure email changes, minimum password length 12, and TOTP enrollment/verification availability.
- Public mail DNS contains Zoho EU MX, Zoho SPF and monitoring-only DMARC. No DNS changes were made and DKIM is not claimed verified without its configured selector/provider evidence.
- A fresh production snapshot was captured and decrypt-verified: 78 database tables and zero current Storage files. The encrypted archive and receipt remain inside ignored `.backups/`; this does not complete off-device backup setup.

## External setup still requiring account access or an owner decision

1. Choose a private off-device backup destination. Existing encrypted snapshots remain local; no patient/Auth snapshots, operator tokens or backup keys were uploaded to GitHub. The code repository is public. External schedules, retention, separately held encryption keys and full hosted recovery still need completion.
2. Confirm failed-workflow notification preferences and receipt in the owner's inbox. A successful readiness workflow does not prove alert delivery. GitHub schedules are best effort and may be disabled after 60 inactive days; use a dedicated uptime provider for dependable intervals.
3. Test production signup/confirmation and recovery with a controlled owner account. SMTP authentication alone is not proof of inbox receipt. Obtain Zoho's actual DKIM selector and alignment evidence before stronger DMARC enforcement.
4. Decide commercial hosting and finish company/legal/clinic-pilot gates in PRODUCTION_CHECKLIST.md. TOTP provider support is present; application MFA enrollment/enforcement remains an explicit product/security gate. Supabase leaked-password protection requires a paid plan; it was not enabled.

## Hosted monitor evidence

- Implementation revision: `f6bf072fbcb6f0883272408116ef501ffd66bb67`, pushed to `main`.
- GitHub workflow readback: `active`; first [manual production readiness run](https://github.com/hypeskall/voxa-os/actions/runs/37197872919) completed successfully, including the live public checks.
- The [complete quality run for this implementation](https://github.com/hypeskall/voxa-os/actions/runs/37197847405) completed successfully, including browser tests and optimized build.
- Vercel deployment `dpl_88dVG1uBGgRSnmXhBK1LwV2kg9rm` for that revision is `READY` (`voxa-8j8o4ndp8-voxa6.vercel.app`).
- The schedule is installed on the default branch. An initial scheduled trigger is not claimed observed; manual dispatch proves the hosted job can execute. Owner email notification preferences and alert inbox receipt are not claimed verified.

## Continued setup: signup and encrypted backup transfer

- A controlled production signup exposed an additional configuration fault: `disable_signup=true`. The first request created no account. After explicit owner authorization, only `disable_signup=false` was changed and read back. Mandatory email confirmation, anonymous-user prohibition and the production callback origin were verified preserved. `launch-config.mjs` now includes public signup in its repeatable Auth configuration.
- The owner's specified test address had no existing production account. A single normal signup after the fix succeeded and required email confirmation; no admin auto-confirmation or existing password reset was performed. Receipt/confirmation and recovery acceptance remain pending. Private test credentials/state are Git/Vercel-ignored and the address is omitted from published reports.
- Production Auth's current email-send quota is 2/hour and minimum frequency 60 seconds. These limits were not increased. Size the quota against the actual Zoho plan before admitting a public pilot; forms can otherwise be limited despite a healthy site.
- Prepared the EU/private R2 operator transport and a redacted configuration template. Eight synthetic encryption/transfer tests pass, including wrong keys, public/unknown privacy state, conditional-write races, idempotent retry and corrupted download rejection. Existing production and staging archives decrypt under the extracted codec (78 tables in each; zero/two current Storage files respectively).
- No Cloudflare account/subscription, credentials or real remote bucket are configured. No snapshot was uploaded, no recurring backup job or retention deletion was enabled, and no physical/PITR/full hosted restore is claimed. Owner account setup and exact-destination approval are next; instructions are in BACKUP_SETUP.md.
- Validation for this continuation: 202 tests in 27 files pass; lint/typecheck and optimized build pass; runtime dependency audit reports zero known advisories. The synthetic isolated restore again matches all 48 public application tables and verifies two Storage files. Existing encrypted production/staging archives remain readable. Browser confirmation, real R2 transfer and scheduled-job failure alert are not claimed tested.
