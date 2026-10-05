# Voxa-OS subscription operations

The public homepage is `/`. Login and account registration remain `/login` and `/register`. Successful clinic authentication resolves the workspace through `/dashboard`. Existing clinic routes, memberships and onboarding are retained.

## Deploying the schema

Apply all existing migrations followed by `supabase/migrations/202610030032_subscriptions_and_licenses.sql` through the existing Supabase migration process. Deploy the application after the schema is present. This implementation does not automatically migrate a hosted project or deploy it.

The dedicated `organization_subscriptions` table is authoritative. Legacy organization trial columns remain for compatibility; changing them cannot extend access. Existing organizations keep their original trial dates. Legacy `subscription_status='active'` without a verified entitlement is deliberately not converted into paid access. Reconcile any genuinely paid organizations with a valid license before rollout. New organizations receive exactly 30 days in their creation transaction, without a browser or scheduler dependency.

## Access rules

- Trial access requires `status='trialing'` and database time inside the trial interval.
- Paid access requires `status='active'`, a current bounded period and a verified entitlement source. A license must also be active, assigned to that organization and unexpired.
- `past_due`, `inactive`, `expired` and `canceled` deny access. For future scheduled cancellation, retain `active` and set `cancel_at_period_end` until the current period ends.
- Access is denied at the exact end timestamp. Checking access refreshes expired states and emits one event per transition. The optional expiry sweep provides proactive event reporting; access never depends on it running.
- No clinic data is deleted when access expires. Basic clinic/organization metadata and the current user's account remain accessible. Operational RPCs, reads/writes and medical storage stay blocked by existing role policies plus subscription enforcement.
- Staff permissions and organization management require entitlement in PostgreSQL. Restrictive RLS policies also cover tenant operational tables. Public booking/confirmation functions, patient portal access and the notification worker enforce entitlement despite their SECURITY DEFINER context.
- `requireClinic` enforces entitlement for server pages, actions and API handlers; direct calls to PostgreSQL cannot bypass the equivalent database checks. Layouts alone are not the access boundary.
- Billing lives outside the gated clinic layout at `/organizations/<uuid>/billing`. Only an active `OWNER` may read billing history or activate a license. Non-owners see a lock screen directing them to the owner.

## Issuing licenses

Use Node 24+ and a trusted operator environment with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The service-role credential must never be put in a public environment variable, sent to a tenant or added to the browser. The CLI applies the existing staging target safety check.

```sh
node --env-file=.env.local scripts/licenses.mjs issue --organization <organization-uuid> --months 1
node --env-file=.env.local scripts/licenses.mjs issue --months 1
node --env-file=.env.local scripts/licenses.mjs revoke <license-uuid>
node --env-file=.env.local scripts/licenses.mjs expire
```

The issuer creates 128 random bits using Node cryptography, formatted as `VOXA-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX`. It displays the plaintext once. Only the SHA-256 digest and last four characters are stored. Tenant reads cannot access the hash. Operators should distribute the code securely after confirming payment. There is no public generation endpoint or organization-owner generator.

An assigned code can only be redeemed by that organization's owner. An unassigned code binds to the first authorized organization that redeems it. Redemption is atomic, locks the subscription and license, and succeeds only once. Codes are redeemable for 30 days by default; activation grants a calendar month (or 1–12 specified months). Early renewal preserves remaining paid days. Unused trial days are not added to paid periods. Failed code attempts return the same safe error and persist; after ten attempts per organization, redemption waits until the 15-minute window resets. Revocation invalidates access immediately, including before a status-refresh job runs.

Optional `expire` can be run from a trusted external scheduler with operator credentials. The check is database-time based, so this is for prompt audit transitions, not enforcement. License expiry is automatic; expired and revoked codes cannot be reused.

## Marketing media and contact

`public/marketing/` contains captures of the actual dashboard, calendar, appointment drawer, patient profile, patient register, doctors, services and team screens using synthetic test data. They contain no real patient data. The editorial product sections use optimized images; mobile previews retain enough width to read the interface and support horizontal browsing. The separate six-chapter walkthrough lasts 24 seconds, supports pause/resume/replay and keyboard chapter selection, and pauses when offscreen or the browser tab is hidden. Reduced-motion preferences remove camera movement and transitions. Only the next scene is prefetched during playback.

Set `VOXA_DEMO_VIDEO_URL` to a local MP4/WebM path or an HTTPS MP4/WebM URL to replace the walkthrough with a native functional video player with a poster and no initial video download. Hosted video iframe providers are not integrated. To refresh the screenshots, set `VOXA_CAPTURE_MARKETING=1` in the operator shell and run the `captures actual app product views` Playwright scenario; it starts only the local protocol fixture and captures the existing app. The fixture also seeds fictional historical appointments so the daily dashboard is populated. Ordinary test runs save captures to ignored `test-results` instead of overwriting the marketing assets.

The public footer provides accessible information dialogs for privacy controls and subscription conditions, rather than presenting an invented legal policy. Contractual/privacy documents still require the operator's approved details. `VOXA_SUPPORT_EMAIL`, when configured, supplies the public Contact link; otherwise Contact explains the existing subscription-page route.

Set `VOXA_SUPPORT_EMAIL` to the real activation/support email before public launch. The owner contact page uses it to compose an activation request. If unset, it clearly directs owners to their Voxa representative rather than inventing a working support address. This feature does not send email automatically.

## Future online payments

Stripe Checkout, Billing Portal and signed webhooks support separate staging sandbox and explicit production live configurations. See [STRIPE_SANDBOX.md](STRIPE_SANDBOX.md) and [STRIPE_LIVE.md](STRIPE_LIVE.md) for setup and acceptance. Manual licenses and original trial dates remain compatible. Server-only reconciliation verifies the current subscription, configured price, paid invoice period and successful unrefunded Stripe charge; it deduplicates event updates atomically. Every price, subscription, invoice, payment and charge must match the configured mode. Browser redirects cannot grant access. Stripe Tax collection remains disabled.

Signup creates a 30-day free trial without collecting a card. Explicit Stripe subscription checkout authorizes monthly renewal at 19,99 EUR per organization, after the remaining trial; cancellation takes effect at period end. Manual licenses do not renew automatically. The owner handles tax treatment and legal/commercial policies separately.
