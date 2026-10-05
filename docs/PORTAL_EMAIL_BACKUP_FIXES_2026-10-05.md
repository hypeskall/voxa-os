# Portal, emailuri și backup — 5 octombrie 2026

## Rezultat curent

Publicat pe `https://voxa-os.vercel.app`: deployment `dpl_sysZzbdgWwrukkKWmsWVNZqxomKp`, READY/dub1, verificat prin aliasul live și manifestul SHA-256. Toate cele 383 fișiere sursă corespund snapshotului de publicare, inclusiv 270 runtime; diferențele ulterioare sunt doar documentație. Commitul sursei se identifică prin `git log -1 --format=%H -- docs/PRODUCTION_SOURCE_MANIFEST_2026-10-05.json`. Release-ul anterior este păstrat separat în commitul `a1e46d35bdcccba6af76cbf58a9f47b8d874d038`.

- **Documente:** utilizatorul a confirmat că pagina funcționează. Nu a fost reimplementată și nu se pretinde identificarea unei cauze pentru eroarea temporară.
- **Emailuri:** producția folosea efectiv cele patru șabloane de staging și subiectele implicite în engleză. Au fost înlocuite cu subiecte în română și șabloane dedicate producției, cu identitate Voxa, buton de acces, explicații clare și suport. Trimiterile viitoare folosesc noile texte. Mesajele vechi din Inbox nu se modifică. Readbackul tuturor celor opt câmpuri a trecut; nu s-au trimis emailuri de test în această etapă.
- **Portal:** pagina `/portal/login` afișa formularul inclusiv dacă exista deja o sesiune validă. Acum verifică utilizatorul pe server și redirecționează la `/portal`. Nu se prelungește artificial sesiunea și nu se dezactivează verificarea Auth. Setările producției erau deja fără timebox/inactivity/single-session; expirarea JWT de o oră nu echivalează cu expirarea sesiunii care se poate reîmprospăta.
- **Remindere:** mesajul de la 06:05 era conform regulii vechi de două ore înaintea programării de la 08:10, cu verificări la cinci minute. Intervalul adoptat și comunicat este 08:00–20:00, în fusul clinicii. Dacă momentul calculat este înainte de 08:00, reminderul se mută la 19:55 în ziua precedentă; dacă este la/după 20:00, la 19:55 în aceeași zi. Reîncercările nocturne și reminderele pentru programări trecute/anulate sunt blocate la claim. Confirmările și alte mesaje tranzacționale își păstrează momentul evenimentului. Migrația forward 041 este aplicată în staging și producție, cu 1.462 verificări de catalog trecute.

## Backup verificat acum

Execuția reală `schedule` [37268276425](https://github.com/hypeskall/voxa-backup-runner/actions/runs/37268276425) s-a încheiat cu succes. A început la 08:32:58, ora României; copia R2 a fost creată la 08:34:17. Programarea nominală este 00:17 UTC, iar această execuție GitHub a fost întârziată; nu garantează o oră exactă sau un RPO de 24 ore.

Copia cea mai recentă din ziua respectivă a fost descărcată pentru verificare read-only: bucket EU privat, SHA-256 corect, decriptare AES-GCM autentificată, 80 tabele și 2 fișiere Storage verificate. Conținutul nu a fost afișat. Nu s-a făcut restaurare în producție. Restaurarea izolată completă a fost demonstrată anterior, pe 4 octombrie; rezultatul de azi verifică integritatea backupului, fără a pretinde repetarea restaurării.

O copie criptată locală nouă, necesară înainte de migrație, a fost inițial respinsă de revizuirea automată. După mesajul explicit al utilizatorului „îți dau autorizare completă”, aceasta a fost creată în `.backups` și decriptată/verificată. Nu s-au schimbat retenția, runnerul, PITR sau tokenurile. Verificarea primei execuții reale nu mai este restantă pentru 6 octombrie; deciziile despre retenție/RPO/RTO rămân separate, ale proprietarului.

## Verificări rulate în această etapă

| Comandă | Mediu | Rezultat final |
| --- | --- | --- |
| `npx vitest run tests/reminder-daytime.test.ts tests/notification-scheduler.test.ts tests/reception-results.test.ts tests/auth-email-templates.test.ts tests/transactional-email.test.ts` | Local | 17/17 trecute; ferestre orare, DST, claim/retry, anulare, izolare și texte. Fixturele au fost corectate înaintea rezultatului final. |
| `npm run typecheck` | Local | Trecut. |
| `npm run lint`, apoi ESLint pe fișierele ajustate ulterior | Local | Trecute. |
| `npm run build` | Local | Trecut, build optimizat. |
| `node scripts/staging-cli.mjs migrate --apply` | Staging | 41 migrații și 1.462 verificări trecute. |
| `npx playwright test --config playwright.hosted.config.ts tests/hosted-browser/reception-results.spec.ts` | Staging real | 1/1 trecut: revenire la login, reload, filă nouă, cookies persistente Secure/HttpOnly, upload/download și alt pacient refuzat. Prima încercare a întâlnit protecția Preview; reîncercarea a folosit credentialul automat existent, fără creare de acces nou. |
| `node scripts/configure-auth-emails.mjs apply`, apoi `check` | Producție | Patru subiecte și patru șabloane verificate; zero emailuri trimise pentru test. |
| `node scripts/production-release.mjs apply` | Producție | Exclusiv migrația 041, atomic; fără reset/seed/rescriere. 1.462 verificări trecute. |
| Release operator cu allowlist de 15 fișiere, verificare secrete, schema și acceptance hosted | Producție | READY; sursa neînrudită a rămas identică. |
| `npm run monitor:check` | Live | 6/6 trecute după deploy. |
| Alias Vercel, GET `/portal/login` și citirea definițiilor reminderelor | Live, read-only | Alias corect, pagină 200 cu textul nou, politica și guardul prezente. Funcțiile private nu au fost expuse pentru testare. |
| Comparație snapshot/manifest și scanare credentiale | Local + Vercel read-only | 383/383 sursă identice, zero constatări. |
| Git status/diff/check/commit/push | Local + GitHub | Commit de bază separat, apoi corecția; push normal pe branch-ul existent, fără merge în main. |

245/62/29 sunt rezultatele istorice ale auditului anterior, nu teste rulate din nou acum. Testul sesiunii pacientului s-a desfășurat în staging cu date fictive; verificarea live după deploy a fost anonimă/read-only. Nu s-au efectuat plăți sau modificări de pacienți reali. Nu se declară produs fără buguri, conformitate completă sau SLA garantat.

## Fișiere ale corecției și motiv

| Fișier | Motiv |
| --- | --- |
| `scripts/auth-email-templates.mjs` | Selectare distinctă staging/producție și subiecte în română. |
| `scripts/auth-email-templates.d.mts` | Tipuri pentru modul. |
| `scripts/configure-auth-emails.mjs` | Actualizare/readback strict al șabloanelor, pe țintă fixă; fără modificări SMTP/Auth generale. |
| `scripts/launch-config.mjs` | Previne reinstalarea șabloanelor staging în producție. |
| `supabase/templates/production-auth-invite.html` | Invitație pacient în română, brand și link securizat. |
| `supabase/templates/production-magic-link.html` | Conectare portal în română și instrucțiuni. |
| `supabase/templates/production-confirm-signup.html` | Confirmare cont în română, fără staging. |
| `supabase/templates/production-recovery.html` | Recuperare parolă în română, păstrează confirmarea explicită anti-scanner. |
| `src/app/portal/login/page.tsx` | Reutilizează sesiunea validă. |
| `src/app/clinics/[clinicId]/notifications/page.tsx` | Explică intervalul real al reminderelor. |
| `supabase/migrations/202610050041_reminder_daytime_delivery.sql` | Programare în timpul zilei și guard pentru retry/programări nevalide. |
| `tests/auth-email-templates.test.ts` | Regresii ale textelor și linkurilor. |
| `tests/reminder-daytime.test.ts` | Ferestre, DST, guard și anulare. |
| `tests/notification-scheduler.test.ts` | Fixture de retry general pe eveniment valid, fără reminder orfan. |
| `tests/hosted-browser/reception-results.spec.ts` | Persistență reală în browser și credentialul staging existent. |
| `docs/PRODUCTION_SOURCE_MANIFEST_2026-10-05.json` | Amprentele versiunii publicate acum. |
| `docs/PORTAL_EMAIL_BACKUP_FIXES_2026-10-05.md` | Raportul acestei corecții și limitele dovezilor. |
| `docs/RELEASE_RECONCILIATION_2026-10-05.md` | Identificarea celor două release-uri și închiderea Git. |
| `PRODUCTION_CHECKLIST.md` | Marchează corecțiile și execuția schedule verificată. |
| `CONTEXT_COMPLET_VOXA_PENTRU_GPT_2026-10-05.md` | Context actual pentru următorul prompt; nu redeschide probleme rezolvate. |
| `docs/BACKUP_SETUP.md` | Dovada actuală a backupului programat. |
| `README.md` | Link la raportul actual. |

Utilitarele de audit/deploy, snapshoturile, receipturile, credentialele și actorii de test rămân ignorate; nu sunt comise. Nu se face force push sau merge în `main`. Firma/fiscalitatea, documentele juridice finale, Vercel comercial și pilotul real rămân responsabilități distincte ale proprietarului.
