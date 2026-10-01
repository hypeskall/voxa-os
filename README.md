# Voxa

Aplicație B2B pentru administrarea clinicilor. Implementarea include fundația multi-tenant, programările, booking-ul public, comunicările, documentele medicale private, rezultatele versionate și portalul pacientului. Documentul original este păstrat intact, iar interfața este în română.

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
| `NOTIFICATION_PROVIDER`                 | `development` sau `webhook`                            |
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

Conturile reale de personal se creează prin API-ul administrativ Supabase Auth într-un proces protejat. Public signup este dezactivat. Personalul activează portalul din profilul pacientului, iar pacientul intră prin magic link Supabase fără drepturi de staff.

## Verificări

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
3. Ajustați `site_url` pentru domeniul real și aplicați configurația Auth cu `supabase config push` folosind configurația mediului; păstrați signup dezactivat și rate limits restrictive.
4. Configurați variabilele din `.env.example` în Vercel. Secretele rămân server-only. Aplicați migrations 020–021 și activați Supabase Cron folosind [setup-ul schedulerului](docs/NOTIFICATION_SCHEDULER.md). Jobul rulează la fiecare cinci minute, cu secret în Vault. Workflow-ul GitHub este disponibil doar pentru pornire manuală.
5. Păstrați un singur proiect Vercel de producție conectat la acest repository. Folosiți presetul Next.js, directorul rădăcină al repository-ului, `npm ci`, `npm run build`, directorul de ieșire implicit și Node.js 24.x. `vercel.json` nu conține cron jobs, fiind compatibil cu Hobby.
6. Folosiți HTTPS, conturi reale și verificați autentificarea/deconectarea, refresh-ul cookie-urilor, accesul multi-clinic și revocarea rolurilor pe mediul de staging.

Nu aplicați `db reset` pe producție. Cookie-urile sunt Secure în build-ul production; testați local autentificarea cu `npm run dev` sau HTTPS. Nu cache-uiți răspunsuri autentificate la un CDN: proxy-ul trimite `private, no-store`.

## Arhitectură

`src/app`: rute și compoziție server. `src/features/auth`: autentificare și autorizare. `src/features/core-clinic`: registre. `src/features/dashboard` și `reports`: operațiuni și agregări server-side. `src/features/scheduling` și `calendar`: motorul și interfața programărilor. `src/features/confirmations`: tokenuri publice semnate. `src/features/notifications`: contract provider, adaptere și worker. `src/features/documents`: storage privat. `src/features/results`: workflow și PDF A4. `src/features/patient-portal`: identitate separată și experiența pacientului. `supabase`: schema, RLS, RPC-uri, audit și seed. Detalii: [ARCHITECTURE.md](docs/ARCHITECTURE.md).

Fișierele sunt păstrate în bucket-ul privat `voxa-medical`; descărcările trec prin autorizare server-side și URL-uri semnate pentru 60 de secunde. Rezultatele parcurg `DRAFT → VALIDATED → RELEASED`, păstrează versiuni și devin vizibile pacientului numai după publicare. Adapterul `development` înregistrează doar metadate mascate; livrarea reală cere configurarea adapterului webhook cu acreditările furnizorului ales.
