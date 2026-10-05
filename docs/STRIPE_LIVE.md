# Voxa-OS live billing — 5 October 2026

The owner explicitly requested real payments and supplied a live server key privately in `.env.stripe-live.local`. Live account verification, the 19.99 EUR/month price, customer portal and dedicated production webhook are configured and deployed. Production database migrations 036–039 were applied forward after an encrypted, decrypt-verified snapshot and verified private EU upload; all 1,459 schema checks pass. Live production acceptance passed on 5 October 2026.

## Configuration

`APP_ENVIRONMENT=production`, `STRIPE_BILLING_MODE=live` and `STRIPE_BILLING_ENABLED=true` are required together. Preview deployments reject live mode. A sandbox credential cannot enable production billing; live keys cannot enable staging billing. The account must match `STRIPE_ACCOUNT_ID`, return a live balance and have `charges_enabled=true`. The price must be active, live, EUR 1999 cents, monthly and licensed.

Server secrets are stored in ignored environment files and sensitive production Vercel variables. Hosted Checkout needs no publishable browser key. The live endpoint is `https://voxa-os.vercel.app/api/stripe/webhook`, without staging protection bypass tokens. Signed webhook events, prices, subscriptions, invoices, payments and charges must all match live mode; connected-account events are rejected. Unmapped customers and browser redirects never grant access.

Use `node scripts/stripe-live-setup.mjs check` to verify the private key/account without mutations, and `configure` to provision or reuse the live catalog, portal and endpoint. Interrupted setup saves resource IDs privately; it does not silently duplicate a webhook whose signing secret is unavailable. Use `node scripts/stripe-live-release.mjs configure`, then `deploy` after the production schema checks pass. These operations never charge a customer or create a subscription.

## Subscription behavior

The existing local 30-day trial requires no card and is never restarted by checkout. Explicit subscription checkout authorizes monthly renewal; portal cancellation preserves access through the paid period. Licensing remains supported. Tax collection is disabled; the owner handles company, offer, tax treatment and commercial hosting separately from this technical task.

## Acceptance

- Sandbox hosted Checkout completed with the official test card, card entry and paid invoice. Stripe recorded a successful 3DS 2.1.0 challenge authentication, and the signed webhook activated the isolated organization. The synthetic subscription was canceled afterward. [Browser evidence](stripe-checkout-2026-10-05.png).
- 235 tests passed in the full local suite, plus three targeted signed-webhook mode tests. Type checking and lint pass.
- Production email notifications are active. The actual five-minute scheduler sent one synthetic message to the controlled contact inbox at 01:10 Bucharest time on 5 October, with one attempt and a durable accepted SMTP record. Inbox receipt is not inferred from SMTP acceptance. The synthetic location/patient were archived afterward.
- The Voxa logo is available as SVG, six-size ICO and Apple touch PNG and is deployed to production.
- Production acceptance verifies the live account is charge-enabled, the endpoint returns 200 for a signed live event with an unmapped synthetic customer, and returns 400 for a signed sandbox event or an invalid signature. Billing mappings remain unchanged. All six public readiness checks pass, and deployed favicon, SVG and Apple icon bytes match the local Voxa assets. Use `node scripts/stripe-live-acceptance.mjs` to repeat these checks without charging a customer.
- Public pricing and FAQ explain Stripe activation, monthly renewal, portal cancellation and the no-card trial; manual licenses remain available.

This acceptance does not claim a real customer payment or an uptime/recovery SLA.
