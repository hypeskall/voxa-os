# Voxa

Actualizare 5 octombrie: [emailuri în română, sesiunea portalului, remindere în timpul zilei și backupul verificat](docs/PORTAL_EMAIL_BACKUP_FIXES_2026-10-05.md).

Release curent: [auditul din 5 octombrie](docs/DEEP_AUDIT_2026-10-05.md) · [reconcilierea cu Git](docs/RELEASE_RECONCILIATION_2026-10-05.md) · [manifestul sursei publicate](docs/PRODUCTION_SOURCE_MANIFEST_2026-10-05.json). Hosted staging: [ghid](docs/HOSTED_STAGING.md); restaurarea, MFA și pilotul fictiv au [dovezi istorice separate](docs/ACCEPTANCE_1_4_2026-10-04.md). Lansarea comercială și datele medicale păstrează deciziile proprietarului din [checklist](PRODUCTION_CHECKLIST.md).

Aplicație B2B pentru administrarea clinicilor. Implementarea include fundația multi-tenant, programările, booking-ul public, comunicările, documentele medicale private, rezultatele versionate și portalul pacientului. Documentul original este păstrat intact, iar interfața este în română.

Pagina publică Voxa-OS este la `/`, iar intrarea în aplicație este la `/dashboard`. Planul unic costă **19,99 EUR/lună**, cu **30 de zile gratuit**, fără card la înscriere. Migrarea `202610030032_subscriptions_and_licenses.sql` adaugă abonamente, licențe și blocarea accesului operațional după expirare. Stripe Checkout, portalul și webhookurile semnate sunt integrate; abonarea explicită activează reînnoirea automată. Staging folosește exclusiv sandbox, iar producția cere modul live și chei live distincte. [Ghid de operare și activare](docs/SUBSCRIPTIONS.md) · [Stripe live](docs/STRIPE_LIVE.md).

## Cerințe și instalare

- Node.js 22.12+ (verificat cu Node 24), npm.
- Supabase CLI și Docker pentru întregul mediu Supabase local, sau un proiect Supabase dedicat.

```sh
npm ci
cp .env.example .env.local
npx supabase start
npx supabase db reset
npx supabase status
npm run dev
```

În PowerShell folosiți `Copy-Item .env.example .env.local`. Completați URL-ul local și cheia `anon`/publishable din `supabase status`. `.env.local` nu se versionază. Variabile:

| Variabilă                              | Scop                                                  |
| -------------------------------------- | ----------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | URL proiect Supabase                                  |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Cheie publică publishable (sau anon pentru CLI local) |
| `BOOKING_RATE_LIMIT_SALT`               | Secret server-only pentru amprenta cererilor publice  |
| `SUPABASE_SERVICE_ROLE_KEY`             | Exclusiv server: worker și invitații portal           |
| `CONFIRMATION_TOKEN_SECRET`             | Semnarea linkurilor de confirmare                      |
| `CRON_SECRET`                           | Autorizarea workerului de notificări                   |
| `APP_ORIGIN`                            | Originea canonică pentru linkuri                       |
| `BOOKING_EMBED_ORIGINS`                 | Origini HTTPS permise pentru widget-ul iframe          |
| `NOTIFICATION_PROVIDER`                 | `development`, `smtp` sau `webhook`                    |
| `NOTIFICATION_PROVIDER_URL/TOKEN`       | Adapter webhook de producție, opțional                 |

Cheia `service_role` este importată numai din module `server-only` sau scripturi administrative locale. Nu adăugați chei private cu prefixul `NEXT_PUBLIC_`.

Autentificarea echipei acceptă utilizator + parolă și păstrează accesul conturilor existente prin email. Numele de utilizator au 3–32 caractere (litere ASCII, cifre, punct, `_`, `-`) și sunt unice global, fără diferență între majuscule și minuscule. Supabase Auth le stochează folosind identificatori interni în domeniul rezervat `users.voxa.invalid`; parolele și sesiunile sunt gestionate de Supabase, fără o bază separată de parole. Conturile fără email livrabil necesită recuperarea accesului prin administrator.

Conturile demo se creează exclusiv prin scriptul administrativ `scripts/create-demo-user.mjs`, folosind `.env.production.local` și variabilele temporare `DEMO_USERNAME`, `DEMO_PASSWORD`, `DEMO_FULL_NAME`, `DEMO_CLINIC_ID`. Scriptul acordă doar rolul RECEPTION în clinica indicată, verifică autentificarea și nu resetează parolele conturilor existente. Credentialele demo nu se salvează în cod sau migrations.

## Baza de date

Migrations din `supabase/migrations` creează întreaga schemă, indici, checks, foreign keys, permisiuni, RLS, trigger de profil Auth, audit și funcții tranzacționale. `supabase/config.toml` versionază configurația locală Auth și limitele de autentificare. Schema `private` nu este expusă prin API.

```sh
npx supabase db reset       # DOAR local; șterge și reconstruiește baza locală
npm test                   # PostgreSQL/PGlite + validare; fără Docker
```

Seed-urile locale implicite sunt exclusiv pentru development: două locații fictive din Oradea și o organizație separată pentru verificarea izolării. `seed-core.sql` adaugă registre fictive pentru testele de securitate și flux. Interfața nu generează date simulate când baza este goală.

Pentru instalarea demonstrativă Clinica Maria, rulați separat `supabase/seed-clinica-maria.sql` după migrations. Fișierul este idempotent și configurează identitatea clinicii, programul general, specialitățile, medicii publicați, serviciile, cabinetele, echipamentele și relațiile folosite de scheduling. Duratele, buffer-ele și identificatorii interni marcați `DEMO DEFAULT` sunt valori operaționale configurabile și trebuie confirmate înainte de producție. `supabase/seed-demo-appointments.sql` este opțional, conține exclusiv pacienți sintetici și reconstruiește zece programări pentru ziua curentă; nu se include într-un deploy de producție.

Pentru capturi demo, `node scripts/populate-demo.mjs` adaugă programări fictive în următoarele trei zile lucrătoare, pornind de la programările sintetice existente. Configurați `DEMO_ENV_FILE` (implicit `.env.local`) și `DEMO_CLINIC_ID`. Scriptul păstrează programările existente, evită conflictele cu medicii și resursele și nu trimite notificări. Rulările repetate în aceeași zi nu dublează datele. Se rulează explicit numai pe clinica demonstrativă.

Conturi locale: `owner@voxa.test`, `admin@voxa.test`, `reception@voxa.test`, `doctor@voxa.test`, `assistant@voxa.test`, `other@voxa.test`. Parolă locală pentru toate: `VoxaDev!2026`. Aceste date sunt publice și nu trebuie utilizate în producție.

Conturile noi folosesc `/register` (nume, email și parolă de minimum 12 caractere), verificare prin email și `/login`. `/forgot-password` și `/reset-password` folosesc recuperarea Supabase Auth. Configurați SMTP și redirect-ul HTTPS `APP_ORIGIN/auth/callback`. Conturile existente cu utilizator continuă să funcționeze. Portalul pacientului rămâne separat, cu magic link fără drepturi de staff.

## Configurarea SaaS

Primul login fără membership deschide `/onboarding`: identitate, locații, program, servicii, medici, cabinete opționale, echipă opțională și verificare finală. Fiecare pas salvat rămâne în PostgreSQL cu control pentru modificări concurente. Finalizarea creează resursele și relațiile într-o tranzacție. Organizația nouă primește o probă de 30 de zile fără card. După expirare, accesul operațional cere un abonament plătit verificat sau o licență validă. Migration 023 marchează organizațiile existente drept configurate.

Invitațiile sunt linkuri reale pentru ADMIN/RECEPTION/DOCTOR în locația aleasă, valabile șapte zile. Baza păstrează doar hash-ul tokenului; acceptarea cere email Auth verificat identic. Producția folosește Brevo cu confirmare durabilă de acceptare SMTP; staging folosește implicit livrare manuală. Contul poate avea mai multe organizații/locații prin invitații. Contul DOCTOR trebuie asociat separat resursei profesionale din profilul medicului.

Verificarea opțională în doi pași se configurează din `/account/security`. După activare, datele și fișierele private cer codul aplicației de autentificare, inclusiv la cereri directe către API. [Ghid MFA și recuperare](docs/ACCOUNT_MFA.md).

Upload-urile din interfață acceptă maximum **3 MB cumulat per formular**, cu verificarea conținutului și limită Server Actions de 4 MB. Limitele mai mari ale bucket-urilor păstrează compatibilitatea fișierelor existente. Logo-urile folosesc bucket-ul privat `voxa-branding`; fișierele medicale folosesc `voxa-medical`. Pentru fișiere mai mari este necesar un flux separat de upload semnat.

Migrations 023–026 adaugă memberships de organizație, draft-uri, invitații, setări, note clinice, cereri privacy, program personal pentru medici și branding privat. Exportul pacientului este rezervat OWNER. Cererile de ștergere/anonymizare urmează [procedura revizuită](docs/PRIVACY_OPERATIONS.md), fără ștergere automată. Urmați [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) înainte de lansare.

Migration 027 adaugă CNP opțional și autorul înregistrării pacientului. CNP este unic în locație și disponibil numai în profilul autorizat/exportul OWNER; listele paginate, căutarea și proiecția clinică pentru medici îl exclud. Validarea verifică formatul de 13 cifre, fără verificarea autenticității identității. Colectarea cere un scop și o procedură de confidențialitate aprobate de clinică.

Contractele Supabase sunt centralizate în `src/types/database.ts` și verificate de TypeScript. Pentru compararea lor cu schema locală, fără suprascrierea contractelor existente:

```sh
npx supabase gen types typescript --local > supabase/database.generated.ts
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` este alternativa pentru cheia publică dacă nu setați `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Setați `APP_ORIGIN=http://localhost:3000` local și originea HTTPS canonică în producție.

## Verificări automate

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Testele SQL rulează migrations reale în PostgreSQL WASM. Suitele verifică disponibilitatea compusă, bufferele, capacitatea, realocarea, anularea, izolarea, rezervările concurente și fluxurile publice/interne din Phase 4. Testele browser folosesc Edge pe Windows și Chromium pe celelalte sisteme (`npx playwright install chromium`). Serverul de test simulează protocolul Auth, dar execută operațiile în PostgreSQL real cu rolurile `authenticated`/`anon` și politicile RLS. Integrarea cu Supabase Auth/PostgREST găzduit se verifică separat. Instrucțiuni și limite în `docs/ARCHITECTURE.md`. Workflow-ul CI execută aceleași verificări.

## Producție / Vercel

1. Creați un proiect Supabase separat; nu încărcați seed-ul.
2. `npx supabase link --project-ref PROJECT_REF`, apoi `npx supabase db push` (fără `--include-seed`).
3. Ajustați `site_url` pentru domeniul real și aplicați configurația Auth cu `supabase config push` folosind configurația mediului; activați signup prin email, confirmarea emailului, SMTP și rate limits restrictive. Nu folosiți redirect-uri localhost în producție.
4. Configurați variabilele din `.env.example` în Vercel. Secretele rămân server-only. Aplicați migrations 020–021 și activați Supabase Cron folosind [setup-ul schedulerului](docs/NOTIFICATION_SCHEDULER.md). Jobul rulează la fiecare cinci minute, cu secret în Vault. Workflow-ul GitHub este disponibil doar pentru pornire manuală.
5. Păstrați un singur proiect Vercel de producție conectat la acest repository. Folosiți presetul Next.js, directorul rădăcină al repository-ului, `npm ci`, `npm run build`, directorul de ieșire implicit și Node.js 24.x. `vercel.json` nu conține cron jobs, fiind compatibil cu Hobby.
6. Folosiți HTTPS, conturi reale și verificați autentificarea/deconectarea, refresh-ul cookie-urilor, accesul multi-clinic și revocarea rolurilor pe mediul de staging.

Nu aplicați `db reset` pe producție. Cookie-urile sunt Secure în build-ul production; testați local autentificarea cu `npm run dev` sau HTTPS. Nu cache-uiți răspunsuri autentificate la un CDN: proxy-ul trimite `private, no-store`.

## Arhitectură

Documentele publice sunt la `/legal`: termeni, confidențialitate, cookies, DPA și reclamații/ANPC. Rămân proiecte până la completarea firmei și revizuirea operațiunilor reale. `npm run legal:export` generează [documentele pentru revizuire](docs/LEGAL_DRAFTS_RO.md) din aceeași sursă ca paginile. [Procedurile](docs/LEGAL_OPERATIONS_RO.md) și [registrul furnizorilor](docs/PROCESSORS_RO.md) disting propunerile de retenție de ștergerile efectiv implementate.

`src/app`: rute și compoziție server. `src/features/auth`: autentificare și autorizare. `src/features/core-clinic`: registre. `src/features/dashboard` și `reports`: operațiuni și agregări server-side. `src/features/scheduling` și `calendar`: motorul și interfața programărilor. `src/features/confirmations`: tokenuri publice semnate. `src/features/notifications`: contract provider, adaptere și worker. `src/features/documents`: storage privat. `src/features/results`: workflow și PDF A4. `src/features/patient-portal`: identitate separată și experiența pacientului. `supabase`: schema, RLS, RPC-uri, audit și seed. Detalii: [ARCHITECTURE.md](docs/ARCHITECTURE.md).

Fișierele sunt păstrate în bucket-ul privat `voxa-medical`; descărcările trec prin autorizare server-side și URL-uri semnate pentru 60 de secunde. Rapoartele redactate în clinică parcurg `DRAFT → VALIDATED → RELEASED`, păstrează versiuni și devin vizibile pacientului numai după publicare. Recepția poate citi inclusiv rapoartele în lucru și poate încărca rezultate PDF/imagine din Pacienți → profil → Rezultate → Încarcă rezultat. Fișierele bifate „Vizibil în portalul pacientului” apar în secțiunea Rezultate a portalului; accesul pacientului trebuie activat din profil. Recepția nu validează și nu publică rapoartele redactate de medic. Adapterul `development` înregistrează doar metadate mascate; trimiterea reală folosește furnizorul configurat. Audit și verificări: `docs/DEEP_AUDIT_2026-10-05.md`.
