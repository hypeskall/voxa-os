# Operational setup — 4 October 2026

Production remains https://voxa-os.vercel.app. Stripe and patient notification delivery remain deferred. No paid upgrade or hosting migration was performed.

## Configured in this pass

- Added a public GitHub readiness workflow with approximately 15-minute checks, manual dispatch, minimal permissions, pinned official checkout/setup-node actions and no private credentials or artifacts.
- Six checks pass against the actual production site: database health, login, registration, password-recovery form, unauthenticated dashboard redirection and production staging-route isolation. Next.js may redirect a streamed dashboard response through a refresh meta tag; the monitor validates that target rather than treating HTTP 200 alone as successful access.
- Eleven focused tests pass, covering transient retry, database unavailability despite HTTP 200, false Auth pages, exposed dashboards, off-site redirects, streamed redirects and diagnostic suppression. Typecheck/lint passed before publication; hosted workflow activation is verified separately below.
- Production SMTP authentication passes with STARTTLS and certificate verification. No email was sent in this check. Auth readback confirms the production origin, confirmation requirement, secure email changes, minimum password length 12, and TOTP enrollment/verification availability.
- Public mail DNS contains Zoho EU MX, Zoho SPF and monitoring-only DMARC. No DNS changes were made and DKIM is not claimed verified without its configured selector/provider evidence.

## External setup still requiring account access or an owner decision

1. Choose a private off-device backup destination. Existing encrypted snapshots remain local; no patient/Auth snapshots, operator tokens or backup keys were uploaded to GitHub. The code repository is public. External schedules, retention, separately held encryption keys and full hosted recovery still need completion.
2. Confirm failed-workflow notification preferences and receipt in the owner's inbox. A successful readiness workflow does not prove alert delivery. GitHub schedules are best effort and may be disabled after 60 inactive days; use a dedicated uptime provider for dependable intervals.
3. Test production signup/confirmation and recovery with a controlled owner account. SMTP authentication alone is not proof of inbox receipt. Obtain Zoho's actual DKIM selector and alignment evidence before stronger DMARC enforcement.
4. Decide commercial hosting and finish company/legal/clinic-pilot gates in PRODUCTION_CHECKLIST.md. TOTP provider support is present; application MFA enrollment/enforcement remains an explicit product/security gate. Supabase leaked-password protection requires a paid plan; it was not enabled.

## Hosted monitor evidence

Pending publication and manual-dispatch verification. Do not treat local execution as proof that the hosted schedule is active.
