# Voxa-OS — reconcilierea release-ului, 5 octombrie 2026

## Starea găsită
Branch `codex/stripe-sandbox`, HEAD inițial `2a8bceea1e3d5cba7e2ec726f7cf0a11ce9d81c5`; 48 fișiere tracked modificate, 29 untracked, nimic staged. După fetch, upstream avea același HEAD; `origin/main` era cu un commit în urmă, fără divergență.

## Release publicat înaintea problemelor noi
Deployment `dpl_9Bq6VhBjB2LT8NHJ2onmaWC6zgM2`, READY, dub1; domeniul live și sursa snapshotului au fost verificate pe 5 octombrie la 12:18 (Europe/Bucharest). Manifestul `PRODUCTION_SOURCE_MANIFEST_2026-10-05.json` identifică 373 fișiere de aplicație/assets/teste/configurație, inclusiv 265 runtime. Toate corespund snapshotului folosit la publicare, cu normalizare CRLF/LF. Comparația nu pretinde extragerea codului de pe serverul live.

Sursa acestui release este salvată separat în Git înaintea corecțiilor următoare; fișierele modificate între timp rămân în working tree pentru commitul ulterior. Nu sunt șterse sau suprascrise. Commitul de bază se identifică prin `git log --diff-filter=A --format=%H -- docs/PRODUCTION_SOURCE_MANIFEST_2026-10-05.json`.

## Documentație actualizată
Afirmațiile vechi despre Stripe doar sandbox, 3DS, invitații manuale, email dezactivat și accesul recepției au fost marcate ca istorice, fără ștergerea dovezilor. Arhitectura și operațiunile reflectă recepția, uploadul în storage privat, Brevo, Stripe live și Supabase Cron. Email acceptat de SMTP, Inbox confirmat, plată comercială și SLA/RPO/RTO rămân dovezi distincte.

## Verificări în această sesiune
- `git status`, branch/upstream, diff, log, fetch și rev-list: inventarul și relațiile remote confirmate.
- Compararea SHA-256 cu snapshotul: 373/373 sursă și 265/265 runtime, înaintea corecțiilor noi.
- Scanarea credentialelor cunoscute local și a tiparelor provider: zero constatări; fișierele private rămân ignorate.
- `npm run monitor:check`: 6/6 verificări hosted read-only trecute.
- GET homepage/favicon/icon: 200; GET webhook: 405, fără POST/eveniment/plată.
- Vercel API: deployment READY, alias corect; production branch `main`.

245/245 teste interne, 62/62 browser local și 29/29 hosted sunt rezultate istorice ale auditului anterior, nu rerulări în acest task.

## Cerere nouă în curs
Utilizatorul a raportat ulterior emailuri de staging, conectare repetată în portal, reminder la 06:05 și a cerut verificarea backupurilor acum. Pagina Documente a fost confirmată ulterior funcțională de utilizator; nu se reimplementează fără defect reproductibil.

Emailurile de producție au fost corectate prin actualizarea exclusivă a celor patru șabloane și subiecte, cu readback verificat; nu s-au trimis emailuri de probă. Corecția paginii de conectare și migrația 041 pentru remindere sunt testate local și în staging; statusul publicării finale va fi consemnat în raportul dedicat. Build/typecheck/lint au trecut; cele 17 teste relevante au trecut după corectarea fixturelor.

Backupul automat `schedule` din 5 octombrie a trecut; copia R2 creată la 08:34 ora României a fost citită și verificată: checksum, decriptare autentificată, 80 tabele și 2 fișiere. Nu s-a făcut restaurare în producție. Crearea unei copii noi a fost inițial respinsă automat; după autorizarea explicită suplimentară a utilizatorului, copia locală criptată pre-upgrade a fost creată și verificată. Nu s-au modificat retenția, PITR, runnerul sau tokenul backupului.

## Limite și responsabilități separate
Firma/fiscalitatea, documentele juridice finale, planul comercial Vercel și pilotul real aparțin proprietarului. Nu s-au făcut plăți, seed/reset în producție sau onboarding real. Voice AI, Retell, Telnyx, SMS/WhatsApp automatizat rămân excluse. Nu se declară conformitate completă, produs fără buguri sau SLA garantat.

## Inventar al commitului de bază
Fișierele runtime sunt păstrate din snapshotul publicat; documentele noi/actualizate clarifică starea și istoricul. Corecțiile noi sunt salvate ulterior separat.

| Fișier | Motiv |
| --- | --- |
| `.env.example` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `.env.stripe-live.example` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `.gitignore` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `CONTEXT_COMPLET_VOXA_PENTRU_GPT_2026-10-05.md` | Documentație/dovadă; păstrează istoricul și clarifică starea actuală. |
| `PRODUCTION_CHECKLIST.md` | Documentație/dovadă; păstrează istoricul și clarifică starea actuală. |
| `README.md` | Documentație/dovadă; păstrează istoricul și clarifică starea actuală. |
| `docs/ACCEPTANCE_1_4_2026-10-04.md` | Documentație/dovadă; păstrează istoricul și clarifică starea actuală. |
| `docs/ARCHITECTURE.md` | Documentație/dovadă; păstrează istoricul și clarifică starea actuală. |
| `docs/BACKUP_SETUP.md` | Documentație/dovadă; păstrează istoricul și clarifică starea actuală. |
| `docs/DEEP_AUDIT_2026-10-05.md` | Documentație/dovadă; păstrează istoricul și clarifică starea actuală. |
| `docs/HOSTED_STAGING.md` | Documentație/dovadă; păstrează istoricul și clarifică starea actuală. |
| `docs/HOSTED_STAGING_REPORT.md` | Documentație/dovadă; păstrează istoricul și clarifică starea actuală. |
| `docs/LAUNCH_OPERATIONS.md` | Documentație/dovadă; păstrează istoricul și clarifică starea actuală. |
| `docs/LAUNCH_REPORT_2026-10-04.md` | Documentație/dovadă; păstrează istoricul și clarifică starea actuală. |
| `docs/NOTIFICATION_SCHEDULER.md` | Documentație/dovadă; păstrează istoricul și clarifică starea actuală. |
| `docs/PERFORMANCE_AUDIT_2026-10-05.md` | Documentație/dovadă; păstrează istoricul și clarifică starea actuală. |
| `docs/PERFORMANCE_AUDIT_2026-10-05.png` | Documentație/dovadă; păstrează istoricul și clarifică starea actuală. |
| `docs/PRODUCTION_SOURCE_MANIFEST_2026-10-05.json` | Documentație/dovadă; păstrează istoricul și clarifică starea actuală. |
| `docs/RELEASE_RECONCILIATION_2026-10-05.md` | Documentație/dovadă; păstrează istoricul și clarifică starea actuală. |
| `docs/SAAS_IMPLEMENTATION_REPORT.md` | Documentație/dovadă; păstrează istoricul și clarifică starea actuală. |
| `docs/SETUP_REPORT_2026-10-04.md` | Documentație/dovadă; păstrează istoricul și clarifică starea actuală. |
| `docs/STRIPE_ACCEPTANCE_2026-10-04.md` | Documentație/dovadă; păstrează istoricul și clarifică starea actuală. |
| `docs/STRIPE_LIVE.md` | Documentație/dovadă; păstrează istoricul și clarifică starea actuală. |
| `docs/STRIPE_SANDBOX.md` | Documentație/dovadă; păstrează istoricul și clarifică starea actuală. |
| `docs/SUBSCRIPTIONS.md` | Documentație/dovadă; păstrează istoricul și clarifică starea actuală. |
| `docs/SUBSCRIPTIONS_IMPLEMENTATION_REPORT.md` | Documentație/dovadă; păstrează istoricul și clarifică starea actuală. |
| `docs/TRANSACTIONAL_EMAIL_SETUP.md` | Documentație/dovadă; păstrează istoricul și clarifică starea actuală. |
| `docs/deep-audit-doctors.png` | Documentație/dovadă; păstrează istoricul și clarifică starea actuală. |
| `docs/deep-audit-portal.png` | Documentație/dovadă; păstrează istoricul și clarifică starea actuală. |
| `docs/deep-audit-services.png` | Documentație/dovadă; păstrează istoricul și clarifică starea actuală. |
| `docs/stripe-checkout-2026-10-05.png` | Documentație/dovadă; păstrează istoricul și clarifică starea actuală. |
| `scripts/notification-acceptance.mjs` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `scripts/stripe-live-acceptance.mjs` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `scripts/stripe-live-release.mjs` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `scripts/stripe-live-setup.mjs` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `scripts/stripe-staging-release.mjs` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/app/api/stripe/webhook/route.ts` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/app/apple-icon.png` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/app/clinics/[clinicId]/loading.tsx` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/app/clinics/[clinicId]/notifications/page.tsx` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/app/clinics/[clinicId]/results/[id]/page.tsx` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/app/clinics/[clinicId]/results/page.tsx` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/app/error.tsx` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/app/favicon.ico` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/app/globals.css` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/app/icon.svg` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/app/portal/page.tsx` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/components/global-search.tsx` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/components/live-refresh.tsx` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/components/shell.tsx` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/features/auth/access.ts` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/features/auth/mfa.ts` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/features/calendar/appointment-composer.tsx` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/features/calendar/calendar-workspace.tsx` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/features/core-clinic/catalog-registry.tsx` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/features/core-clinic/detail.tsx` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/features/documents/actions.ts` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/features/documents/data.ts` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/features/marketing/landing-page.tsx` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/features/notifications/provider.ts` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/features/patient-portal/activate-portal.tsx` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/features/patient-portal/patient-activity.tsx` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/features/public-booking/booking-widget.tsx` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/features/results/model.ts` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/features/results/patient-results.tsx` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/features/results/result-composer.tsx` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/features/subscriptions/billing-page.tsx` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/features/subscriptions/stripe-actions.ts` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/features/subscriptions/stripe-client.ts` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/features/subscriptions/stripe-model.ts` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/features/subscriptions/stripe-service.ts` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/lib/locale/ro.ts` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/proxy.ts` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `src/types/database.ts` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `supabase/migrations/202610050040_reception_results.sql` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `tests/browser/calendar-booking.spec.ts` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `tests/browser/deep-audit.spec.ts` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `tests/browser/foundation.spec.ts` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `tests/browser/interaction-audit.spec.ts` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `tests/fixtures/supabase.mjs` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `tests/hosted-browser/interaction-audit.spec.ts` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `tests/hosted-browser/reception-results.spec.ts` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `tests/mfa-performance.test.ts` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `tests/reception-results.test.ts` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `tests/rls.test.ts` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `tests/smtp-delivery.test.ts` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `tests/stripe-billing.test.ts` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `tests/stripe-environment.test.ts` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `tests/stripe-live-setup.test.ts` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `tests/stripe-webhook-mode.test.ts` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
| `vercel.json` | Implementare/configurație/test al release-ului publicat; păstrat identic cu snapshotul. |
