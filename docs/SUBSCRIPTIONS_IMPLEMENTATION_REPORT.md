# Voxa-OS public site and subscriptions — 3 October 2026

**Historical implementation report.** Later hosted/live migrations, Stripe and reception/portal acceptance are in [STRIPE_LIVE.md](STRIPE_LIVE.md) and [DEEP_AUDIT_2026-10-05.md](DEEP_AUDIT_2026-10-05.md). Local counts and the absence of deployment in this pass remain historical evidence.

Implemented in the existing Next.js/Supabase repository. Existing organization/location architecture, onboarding, role grants and clinical workflows are retained. Pre-existing working-tree changes were preserved. No hosted migration or deployment was performed.

## Public website visual second pass

The public landing page now uses an asymmetric calendar/appointment hero, a mixed feature layout, alternating editorial product sections, interactive doctors/services/team tabs, a six-scene 24-second walkthrough, one pricing panel, native FAQ details and accessible mobile/footer dialogs. Product captures use fictional data and content-hashed image URLs. Motion uses CSS and IntersectionObserver, with reduced-motion support and playback suspension offscreen or in background tabs. Production SaaS/auth/subscription/license/database behavior was not changed during this pass.

Verification: lint and typecheck passed; 179 unit/database tests and all 44 browser tests passed. The final three landing-page browser scenarios passed again after the screenshot cache and feature-spacing refinements, followed by a successful production build. Actual visual review covered 1920, 1440, 1024, 768 and 390 pixels, including the hero, features, screenshot sections, walkthrough, pricing and mobile menu. Review captures are in ignored `test-results/marketing/`. Footer privacy/terms dialogs describe product controls and subscription conditions; they do not invent approved legal policies.

## Original implementation behavior

1. **Public website:** `/` is a Romanian marketing homepage with a sticky header, hero, product showcase, eight capability groups, guided setup steps, pricing, final trial CTA, six FAQs and footer. Authenticated visitors see dashboard CTAs; `/dashboard` retains the original workspace/onboarding selection behavior. Login and registration remain at their existing URLs.
2. **Pricing:** one organization plan, Voxa-OS Monthly, **19,99 EUR/month**. **30-day free trial**, no upfront trial payment and no automatic charge at trial completion. No additional tiers were invented.
3. **Media:** three real app screenshots captured with synthetic clinic data, tab navigation, a pauseable animated screenshot tour, keyboard controls and reduced-motion support. An optional local/HTTPS MP4 or WebM switches the component to a native working video player. No fabricated video or stock imagery.
4. **Schema:** migration `202610030032_subscriptions_and_licenses.sql` introduces `organization_subscriptions`, `license_keys`, `subscription_events`, and private activation-rate counters. Subscription/period fields form a boundary for a future verified payment-provider adapter.
5. **Trial lifecycle:** organization creation starts exactly one 30-day trial transactionally. Backfill preserves existing trial dates; legacy `active` flags without verified paid entitlements are not treated as payment proof. Access uses database time and does not require a scheduler. Expiration transitions emit audit events; the internal expiry sweep is optional.
6. **Licenses:** internal service-role CLI issues cryptographically random 128-bit codes and displays each once. Only hashes and four-character hints persist. Optional organization assignment, one-use owner redemption, calendar-month entitlements, early renewal preserving paid days, rate-limited failures, expiry and revocation are implemented. Tenants and anonymous users cannot generate or revoke codes, and tenant API reads cannot retrieve their hashes.
7. **Expiry enforcement:** shared server guards protect clinic pages, actions and API handlers. Database role helpers and restrictive RLS protect direct queries and operational mutations. Public booking/confirmation RPCs, patient-portal access, medical storage and notification claims/context also enforce entitlement. Expired organizations retain data and receive a professional lock screen. Billing and logout remain available.
8. **Billing UX:** `/organizations/[organizationId]/billing`, `/billing/contact`, and `/subscription-expired`, outside the gated clinic layout. Only active owners may read billing data and activate licenses. The page shows trial dates/days, status, price, license hint/status, paid expiry, renewal behavior and event history. Existing organization settings link to authoritative billing rather than showing stale legacy status. Non-owner expiry screens direct the user to the owner.

## Verification

| Check | Result |
| --- | --- |
| `npm test` | **179 passed**, 22 files |
| `npm run test:e2e` | **42 passed**, including preserved scheduling/booking, patient/catalog CRUD, login, registration, onboarding, recovery, responsive shell, marketing and billing scenarios |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm run build` | Pass |

The subscription tests execute actual SQL migrations in PGlite PostgreSQL with authenticated/service roles and real RLS. They cover exact trial duration, tenant isolation, immutable entitlements, expiry, blocked reads/writes/RPC/storage, valid activation, duplicate redemption, invalid/expired/revoked/cross-tenant codes, owner-only access, rate limiting, early renewal, paid expiry, revocation and migration backfill. Browser checks cover an expired owner, a protected API redirect, invalid-code feedback, successful activation restoring the app, non-owner billing denial, landing-page images and layouts at 1440/768/390/320 pixels.

Product assets were refreshed from the actual app using the local protocol fixture. Desktop/mobile marketing captures are in ignored `test-results/marketing/`. Hosted Supabase, production email, real payment collection and deployment are not certified by these local results.

## Pending external setup

- Apply migration 032 through the established Supabase migration workflow before deploying this code. Review any genuinely paid legacy organizations and issue their verified entitlements before rollout; an unverified `active` string will not preserve access.
- Set `VOXA_SUPPORT_EMAIL` to the real activation contact. Until configured, the contact page explicitly directs owners to their Voxa representative.
- Optional: provide a real demo video through `VOXA_DEMO_VIDEO_URL`.
- Payment checkout, provider webhooks, invoices and automatic payment collection remain pending. Operator-confirmed license activation is working and does not claim to process payments. The legal/commercial details of the public offer remain an operator responsibility.

Operational steps and integration rules are documented in [SUBSCRIPTIONS.md](SUBSCRIPTIONS.md).

## Exact file manifest for this implementation

### Added

```text
supabase/migrations/202610030032_subscriptions_and_licenses.sql
src/app/marketing.css
src/features/marketing/landing-page.tsx
src/features/marketing/product-showcase.tsx
public/marketing/dashboard.png
public/marketing/calendar.png
public/marketing/patients.png
src/features/subscriptions/model.ts
src/features/subscriptions/access.ts
src/features/subscriptions/actions.ts
src/features/subscriptions/billing-page.tsx
src/app/organizations/billing.css
src/app/organizations/[organizationId]/layout.tsx
src/app/organizations/[organizationId]/billing/page.tsx
src/app/organizations/[organizationId]/billing/contact/page.tsx
src/app/organizations/[organizationId]/subscription-expired/page.tsx
scripts/licenses.mjs
tests/subscriptions.test.ts
tests/browser/marketing-subscription.spec.ts
docs/SUBSCRIPTIONS.md
docs/SUBSCRIPTIONS_IMPLEMENTATION_REPORT.md
```

### Updated existing implementation files

```text
src/app/page.tsx
src/app/dashboard/page.tsx
src/app/login/page.tsx
src/app/not-found.tsx
src/app/onboarding/page.tsx
src/app/auth/callback/route.ts
src/app/clinics/[clinicId]/settings/layout.tsx
src/app/clinics/[clinicId]/settings/organization/page.tsx
src/features/auth/access.ts
src/features/auth/actions.ts
src/features/auth/account-actions.ts
src/features/auth/account-page.tsx
src/features/organizations/access.ts
src/features/onboarding/actions.ts
src/features/settings/settings-nav.tsx
src/types/database.ts
tests/fixtures/supabase.mjs
tests/support/database.ts
next.config.ts
package.json
.env.example
README.md
docs/ARCHITECTURE.md
```

These lists describe this task's scope, including updates to files that already existed as uncommitted work. They do not attribute other pending repository changes to this implementation. Generated Next/TypeScript caches and ignored test artifacts are excluded.
