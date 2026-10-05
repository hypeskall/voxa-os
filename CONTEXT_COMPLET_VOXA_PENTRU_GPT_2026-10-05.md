# Voxa / Voxa-OS — context complet pentru GPT și următorul prompt de lucru

**Data situației:** 5 octombrie 2026, fus orar Europe/Bucharest.
**Proiect local:** `C:\Users\mihai\Documents\Codex\regina maria`
**Aplicație publicată:** https://voxa-os.vercel.app
**Repository:** https://github.com/hypeskall/voxa-os

## 1. De ce îți dau acest document

Vreau să citești tot contextul și să îmi construiești un **prompt final, concret, pentru Codex**, cu ce mai trebuie făcut în proiectul existent. Nu vreau să reconstruim produsul, să repetăm lucrurile deja finalizate sau să prezentăm drept restante sarcini rezolvate între timp.

Promptul trebuie să țină cont de ultimele mele decizii: **firma/oferta și planul Vercel le rezolv eu; backupul a fost amânat pentru discuția din 6 octombrie; pilotul cu o clinică reală este în afara listei tehnice curente.** Notificările și Stripe au fost cerute și finalizate, apoi am cerut un audit de performanță și buguri, care a fost făcut și publicat.

Acest document sintetizează codul, starea Git, rapoartele proiectului și conversația recentă. Prima versiune rezuma rapoartele; după ea am cerut un audit extins și un flux nou pentru recepție. Actualizarea include verificări executate efectiv pe 5 octombrie: 245 teste interne, 62 browser local, 29 hosted și regresii finale. Detaliile sunt în `docs/DEEP_AUDIT_2026-10-05.md`. Nu conține chei API, parole sau date reale de pacient.

## 2. Unde suntem acum, pe scurt

Voxa este o aplicație web B2B pentru administrarea clinicilor, cu backend real, bază de date reală, organizații și locații separate, programări, registre, documente medicale private, rezultate, portal pacient și abonamente.

**După închiderea listei tehnice inițiale am cerut un audit extins:** corectarea tabelelor Medici/Servicii/Resurse, accesul recepției inclusiv la ciornele rezultatelor și încărcarea rezultatelor PDF/imagine pentru portalul pacientului. Acestea sunt implementate, testate și **publicate în producție**: **245 teste interne, 62 browser local, 29 hosted, build optimizat și regresii finale trecute**. Release-ul **`dpl_9Bq6VhBjB2LT8NHJ2onmaWC6zgM2`** este READY/dub1, verificat la **03:12 RO**; șapte endpoint-uri publice au trecut. În sesiunea contului raportat, fila Rezultate a unui pacient existent se afișează și are butonul de încărcare; verificarea live nu a modificat date. Nu confunda deployment-ul anterior de la 02:26 cu acest release.

**Mai există operațiuni și decizii pentru lansarea comercială/date medicale reale**, însă acestea nu trebuie reintroduse automat în lista curentă: firma, fiscalitatea, contractele, hostingul comercial, confirmarea backupului programat, retenția și pilotul real.

**Actualizare ulterioară — reconcilierea release-ului:** toate cele 373 de fișiere executabile/asset/test/configurație coincid cu snapshotul producției; au fost păstrate și înregistrate împreună cu documentația actualizată. Ramura de lucru rămâne `codex/stripe-sandbox`; commitul sursei este cel care introduce `docs/PRODUCTION_SOURCE_MANIFEST_2026-10-05.json`. Raportul complet este în `docs/RELEASE_RECONCILIATION_2026-10-05.md`. Nu s-a modificat cod executabil sau producția în această etapă. Integrarea în `main` este distinctă de reproducerea release-ului și nu trebuie făcută prin suprascriere de istoric.

## 3. Obiectivul produsului și constrângerile inițiale

- Software serios pentru clinici medicale, inclusiv organizații cu mai multe locații, mulți medici și recepții.
- Interfață în română, densitate utilă, tabele clare, calendar medical și formulare funcționale.
- Stil medical matur: fundal neutru, suprafețe albe, text închis, accent verde, mișcare discretă și suport pentru ecrane mici.
- Fără pagini decorative prezentate drept funcționalități, disponibilitate falsă sau date simulate ca backend final.
- PostgreSQL este sursa de adevăr. Datele medicale nu se țin în localStorage.
- Datele demonstrative sunt fictive și folosite explicit pentru teste/capturi; aplicația nu inventează date când baza este goală.
- **AI receptionist, Retell, Telnyx și voice AI au fost excluse explicit din această versiune.** Nu trebuie introduse în promptul final fără o cerere nouă.
- Documentul inițial `MASTER_SPEC.md` descrie construcția de la zero. Acea etapă a fost deja realizată; următorul prompt trebuie să continue implementarea existentă.

## 4. Stack și arhitectură existente

Versiunile declarate în `package.json` includ Next.js `^16.3.6`, React `^19.3.0`, TypeScript `^6.0.3`, Tailwind, Radix, Supabase SSR/client și Stripe `23.0.0`. Cerința documentată este Node.js 22.12+, cu Node 24 verificat și folosit pentru producție.

- Next.js App Router; paginile și operațiile server sunt organizate pe funcționalități în `src/features`.
- Supabase Auth pentru conturi și sesiuni; PostgreSQL pentru date, tranzacții și RLS; Supabase Storage pentru fișiere private.
- Organizație → locații/clinici. Drepturile sunt verificate pentru locația efectivă, inclusiv între locațiile aceleiași organizații.
- Roluri: OWNER, ADMIN, RECEPTION, DOCTOR, ASSISTANT, cu permisiuni verificate în server și bază, nu doar prin ascunderea butoanelor.
- Baza are **40 de migrații versionate**, inclusiv 040 pentru recepție și rezultate încărcate. Staging și producția corespund celor **1.460 verificări structurale**. Producția păstrează propriile ID-uri istorice anterioare upgrade-urilor.
- Migrations sunt aplicate înainte, fără resetarea producției, fără seed demonstrativ la deploy și fără rescrierea istoricului.
- Producția și staging au proiecte Supabase separate. Staging este protejat; uneltele dedicate lui refuză ținte de producție.
- Producția Vercel folosește acum `dub1`/Irlanda, lângă baza din `eu-west-1`. Staging a fost verificat în `fra1`/Frankfurt.
- Brevo este furnizorul SMTP tranzacțional; Stripe gestionează abonamentele; R2 UE și un runner GitHub privat gestionează copiile criptate.

**Regulă obligatorie pentru următorul agent:** `AGENTS.md` cere citirea ghidului relevant din `node_modules/next/dist/docs/` înainte de modificări de cod. Această versiune Next.js poate diferi de API-urile cunoscute din alte versiuni.

## 5. Ce am construit și verificat

### 5.1 Conturi, autentificare și acces

- Înregistrare cu nume, email și parolă de minimum 12 caractere; confirmarea emailului este obligatorie.
- Login, logout, resetarea parolei, callback-uri PKCE și destinații limitate la aplicație.
- Suport păstrat pentru utilizator + parolă și conturile vechi prin email.
- Intrarea în workspace este `/dashboard`; utilizatorul nou fără organizație ajunge la configurare.
- Sesiuni prin cookie-uri HttpOnly, SameSite și Secure în producție; răspunsurile autentificate nu sunt cache-uite public.
- Confirmarea reală a emailului și recuperarea parolei au fost testate; proprietarul a confirmat recuperarea și loginul ulterior.
- Verificare MFA/TOTP opțională din `/account/security`: înrolare, challenge, cod greșit/corect, eliminare verificată și verificarea sesiunilor vechi.
- După activarea MFA, protecția se aplică și tabelelor private, RPC-urilor, Storage și endpoint-urilor de download. Recuperarea parolei nu ocolește MFA.
- Proprietarul a raportat activarea MFA personal; verificarea independentă a folosit conturi sintetice.

### 5.2 SaaS cu mai multe organizații și onboarding

- Organizații și locații distincte, selectarea locației și acces prin memberships curente.
- Wizard în opt pași: identitate, locații, program, servicii, medici, cabinete opționale, echipă opțională, verificare finală.
- Draft-urile sunt salvate în bază și reluate după refresh; modificările concurente sunt detectate.
- Finalizarea creează resursele și relațiile atomic, cu rollback la eroare.
- Invitații ADMIN/RECEPTION/DOCTOR, expirare de șapte zile, token stocat doar ca hash, verificare de email confirmat, revocare și protecție la reutilizare.
- Trimiterea invitațiilor prin SMTP și primirea invitației de test în Inbox au fost confirmate.
- Contul DOCTOR trebuie asociat explicit profilului profesional/afilierei sale.
- Organizațiile existente rămân configurate; datele istorice sunt păstrate.

### 5.3 Registrele clinicii și dashboard

- Pacienți, medici, specialități, categorii, servicii/investigații, cabinete și echipamente, cu relații validate.
- Liste paginate, sortare, căutare, creare/editare, activ/inactiv, arhivare și restaurare.
- CNP opțional, limitat la profilul autorizat/export OWNER; omis din liste, căutare și proiecțiile clinice restrânse. Validarea formatului nu certifică identitatea.
- Dashboard pentru ziua curentă, indicatori, programări și activitate autorizate, sincronizate cu calendarul.
- Căutare globală limitată la permisiunile curente și la clinica selectată.
- Rapoarte agregate, filtre și export CSV cu audit, fără exportarea implicită a listelor de pacienți.
- Preferințe de afișare, filtre și calendar salvate în bază.

### 5.4 Disponibilitate, scheduling și calendar

- Program de lucru, pauze și excepții pentru clinică, medic, cabinet și echipament.
- Durată de serviciu, buffere, eligibilitate și capacitate; combinațiile de resurse sunt calculate pe server.
- Creare, reprogramare, anulare și schimbări de stare prin tranzacții care reverifică disponibilitatea și conflictele.
- Calendar zi/săptămână/lună/agendă, filtre, detalii, istoric, drag-and-drop și ajustări autorizate ale duratei.
- Detectarea duplicatelor și override separat, cu permisiune și istoric.
- Test concurent hosted cu 12 clienți: o rezervare reușită și 11 conflicte explicite pentru același slot. Acesta verifică o cursă de rezervare, nu capacitatea întregului produs.
- Conversie de fus orar și verificări pentru momente ambigue/inexistente la schimbarea orei.
- Formularele și calendarul persistă date reale în bază; nu sunt un demo de interfață.

### 5.5 Booking public și confirmări

- `/book/[clinicSlug]` și widget iframe `/embed/booking/[clinicSlug]`.
- Catalog public minim, selecție serviciu/medic/dată/oră și rezervare cu verificare tranzacțională finală.
- Booking public și recepția folosesc același motor de scheduling.
- Rate limits, verificări same-origin, honeypot și validarea payload-urilor.
- Linkuri de confirmare/anulare semnate, cu expirare/revocare și reguli ale clinicii.
- Utilizatorul anonim nu primește acces la tabelele pacienților sau la datele interne.

### 5.6 Documente, rezultate și portal pacient

- Fișiere în bucket-ul privat `voxa-medical`, branding în `voxa-branding`.
- Descărcările sunt autorizate pe server și folosesc linkuri semnate de 60 de secunde.
- Originalele medicale înregistrate sunt păstrate; nu există suprascriere sau hard-delete obișnuit în interfață.
- Upload verificat după conținut/tip și limitat la **3 MB cumulat per formular**, cu limită Server Actions de 4 MB.
- Rezultate cu flux `DRAFT → VALIDATED → RELEASED`, versiuni și PDF A4.
- Rezultatele devin vizibile pacientului după publicare; documentele au vizibilitate controlată.
- În auditul extins, recepția primește citire inclusiv pentru rezultatele în lucru, în clinica sa. Nu primește redactare/validare/publicare a rapoartelor medicale.
- Recepția poate încărca PDF sau imagine din Pacienți → profil → Rezultate → Încarcă rezultat. Checkboxul „Vizibil în portalul pacientului” este bifat implicit; fișierul apare în Rezultate disponibile din portal, fără duplicare în Documente. Pacientul trebuie să aibă portalul activat. Descărcarea originalului și refuzul pentru alt pacient activ din aceeași clinică au fost testate pe servicii reale.
- Contul indicat de proprietar avea efectiv rolul RECEPTION, de aceea fila Rezultate ducea la pagina indisponibilă. Permisiunea sa este acum verificată în producție; rolul nu a fost schimbat artificial în OWNER.
- Portal pacient separat, cu magic link și fără drepturi de staff.
- Note clinice, program personal și restricții pentru medicul asociat.
- Semnătură și parafă scanate, păstrate privat; nu sunt prezentate drept semnătură electronică calificată.
- Cereri privacy și export pacient OWNER cu audit. Cererile de ștergere sunt un proces de revizuire, nu ștergere automată a datelor și backupurilor.

### 5.7 Comunicări și notificări

- Brevo a înlocuit configurația tranzacțională anterioară Zoho; sender-ul și configurația SMTP au fost verificate.
- Emailurile Auth, invitațiile echipei și alertele operatorului au verificări reale; proprietarul a confirmat primirea mesajelor de test relevante.
- **Notificările email pentru pacienți sunt activate în producție din 5 octombrie.**
- Schedulerul real este **Supabase Cron la fiecare cinci minute**, cu secret în Vault și endpoint protejat. `vercel.json` nu are cron jobs; alternativa GitHub este manuală pentru acest worker.
- Proba controlată a fost trimisă la **01:10 în România, pe 5 octombrie**, la prima încercare. Coada, jurnalul de comunicări și ledger-ul SMTP confirmă acceptarea.
- Confirmarea în Inbox a acestei ultime probe rămâne separată. Acceptarea SMTP nu dovedește singură livrarea în Inbox.
- Ledger durabil pentru prevenirea retrimiterii după acceptare sau livrare incertă; adresele cu domenii demonstrative rezervate sunt blocate înainte de SMTP.
- WhatsApp: butonul deschide conversația cu mesajul pregătit și înregistrează deschiderea. **Nu există aici dovadă de trimitere/livrare automată WhatsApp.**
- SMS nu este configurat prin SMTP; ar necesita un provider distinct dacă este cerut ulterior.

### 5.8 Landing page, ofertă și abonamente

- Landing public în română la `/`, cu prezentarea produsului, capturi reale din aplicație pe date fictive, secțiuni interactive, FAQ și CTA.
- Walkthrough de șase scene/24 secunde, controale de redare și suport reduced motion.
- Intrarea în aplicație rămâne `/dashboard`; login și register au rutele lor.
- Plan curent: **19,99 EUR/lună per organizație**, **30 de zile gratuit, fără card la înscriere**.
- Trial-ul este acordat și verificat în bază; checkout-ul nu îl repornește.
- După expirare, accesul operațional este blocat în server/bază/Storage dacă nu există abonament sau licență validă. Datele nu sunt șterse.
- Billing rămâne accesibil pentru remediere; numai OWNER poate administra abonamentul/licența.
- Licențe manuale emise prin instrument administrativ, cod afișat o singură dată și stocat ca hash, activare atomică, perioadă și revocare.

### 5.9 Stripe sandbox și live

- Checkout, Billing Portal și webhookuri semnate integrate în aplicația existentă.
- Sandbox pe staging și live exclusiv în producție, cu chei/prețuri/evenimente distincte.
- Verificări pentru cont, mod, preț și perioadă plătită; redirect-ul din browser nu acordă acces.
- Evenimente duplicate sau vechi nu dublează istoricul și nu inversează starea actuală.
- Sandbox a fost testat cu plată, refuz, recuperare, rambursare, anulare și izolarea clinicilor/licențelor.
- Blocajul inițial din Checkout/CAPTCHA descris în raportul din 4 octombrie a fost rezolvat prin verificarea ulterioară: **intrare completă de card și challenge 3DS reușit**, urmate de activare prin webhook.
- Proprietarul a cerut explicit plăți reale și a furnizat cheia live privat. Contul live, prețul de 19,99 EUR/lună, portalul și webhookul de producție sunt configurate și publicate.
- Endpoint: `https://voxa-os.vercel.app/api/stripe/webhook`.
- Acceptă evenimente live semnate; respinge evenimente sandbox și semnături invalide în producție.
- Abonarea explicită autorizează reînnoirea lunară; anularea din portal păstrează accesul până la sfârșitul perioadei plătite.
- **Niciun client real nu a fost taxat în verificări.** Activarea tehnică live nu trebuie descrisă ca o tranzacție comercială reală deja demonstrată.
- Stripe Tax este dezactivat; tratamentul fiscal și oferta contractuală sunt în responsabilitatea proprietarului.

### 5.10 Logo și favicon

- Logo existent: „V” alb pe fundal verde.
- Adăugat icon SVG, favicon ICO cu șase dimensiuni și Apple touch icon.
- Disponibilitatea și identitatea fișierelor publicate au fost verificate.
- Nu mai este o sarcină restantă.

### 5.11 Backup, restaurare și monitorizare

- Snapshot-uri criptate, verificare de decriptare și integritate, copii off-device în R2 privat din UE.
- Runner separat în repository privat `hypeskall/voxa-backup-runner`, cu execuții manuale reușite și alertă de eroare intenționată confirmată în Inbox.
- Program zilnic instalat la **00:17 UTC**: 03:17 în România în timpul verii, 02:17 iarna.
- Restaurare completă într-un mediu izolat: **77 tabele Auth/aplicație/private** comparate cu sursa, două fișiere recuperate, login normal al conturilor restaurate și izolare între clinici verificate.
- Restaurarea nu a resetat vreun proiect hosted; runtime-ul temporar a fost eliminat.
- **Prima execuție declanșată efectiv de programarea zilnică nu este confirmată în dovezile disponibile.** Rularea manuală reușită nu o înlocuiește.
- RPO/RTO și retenția nu sunt încă stabilite. Rapoartele nu consemnează backup nativ/PITR activ în producție.
- Cheia de recuperare este păstrată separat, confirmat de proprietar. Tokenul de citire pentru runner trebuie rotit înainte de **2 ianuarie 2027**, conform documentației curente.
- `/api/health`, referințe de eroare fără conținut medical și alerte SMTP pentru operator.
- Workflow public de readiness, aproximativ la 15 minute, cu dovadă de execuție programată reușită. Acesta este diferit de programarea backupului privat.
- Verificările GitHub sunt best effort; nu există SLA de uptime/recuperare demonstrat.
- Pagina `/help` și contactul de suport sunt configurate.

### 5.12 Documente juridice și privacy

- Pagini publice `/legal`: termeni, confidențialitate, cookies, DPA și reclamații/ANPC.
- Conținutul juridic public și exportul Markdown provin din aceeași sursă.
- Există draft-uri, registru de furnizori, proceduri de privacy, incidente, retenție și ștergere/revizuire.
- **Acestea sunt proiecte, nu contracte finale, certificări sau dovadă de conformitate integrală.**
- Firma, CUI, adresa, contractele și aprobările operaționale reale trebuie completate de proprietar.

## 6. Ultimul audit de viteză și buguri — făcut și publicat

Problema raportată: clicurile păreau să dureze 1–2 secunde, iar închiderea formularului de programare cu X/Escape strica vizual calendarul.

Corecțiile realizate:

1. Mutarea serverului de producție din SUA în Irlanda, lângă baza de date; staging lângă baza sa din Frankfurt.
2. Reducerea cererilor duplicate de utilizator/MFA/clinicǎ în aceeași cerere, păstrând verificările de acces actuale.
3. Navigarea calendarului începe imediat; nu mai așteaptă salvarea preferințelor. Schimbarea datei nu face o salvare inutilă.
4. Corectarea animației dialogului și a centrării; închiderea cu X/Escape nu deplasează calendarul și nu blochează clicurile.
5. Anularea/ignorarea răspunsurilor depășite în căutare, booking public, pacienți și detaliile programării.
6. Selectarea orei de reprogramare nu reîncarcă întreaga disponibilitate.
7. Stări distincte pentru încărcare, fără rezultate și eroare la căutarea pacientului.
8. Reîmprospătarea la revenirea în fereastră nu întrerupe dialogul și nu se declanșează redundant.
9. Reutilizarea formatatoarelor de dată/oră fără cache de date medicale.
10. Corectarea overflow-ului de remindere pe ecrane de 320 px.
11. Indicator de încărcare în zona clinicii la navigare.

Măsurători documentate, mediane de răspuns HTML autentificat din trei cereri în **staging**:

| Pagină | Înainte | După |
| --- | ---: | ---: |
| Workspace | 2.382 ms | 288 ms |
| Calendar | 1.784 ms | 264 ms |
| Pacienți | 1.249 ms | 197 ms |
| Medici | 1.470 ms | 213 ms |
| Servicii | 1.201 ms | 227 ms |
| Disponibilitate | 1.653 ms | 295 ms |
| Resurse | 1.202 ms | 412 ms |
| Setări | 998 ms | 197 ms |

Reducerea măsurată este de 66–88%. Formularul s-a deschis în 31–38 ms și închis în 11–70 ms în scenariile hosted testate; schimbarea perioadei a durat 374 ms.

**Limite:** măsurători pe clinică fictivă/staging, nu benchmark universal de producție sau test cu sute de utilizatori. Regiunea și codul au fost măsurate împreună. Auditul nu dovedește absența oricărui bug posibil.

Publicarea finală este documentată pentru **5 octombrie, 02:26 în România**, deployment `dpl_5RhUvDF7VwpGHcAa3PzDQF4cVPvc`, `READY`, `dub1`, cu build de producție, șase verificări publice, Stripe și iconuri verificate. Accesul temporar de automatizare staging a fost revocat după teste.

## 7. Testare: care sunt rezultatele actuale

| Etapă | Dovezi raportate |
| --- | --- |
| Acceptanță din 4 octombrie, înainte de Stripe/audit final | 222 teste interne, 46 browser local, 20 hosted distincte |
| Integrare Stripe sandbox | 228 teste interne și verificări hosted Stripe/licențe |
| Etapa Stripe live | 235 teste interne în suita completă, plus trei teste țintite pentru modul webhook |
| Audit final din 5 octombrie | **242 teste interne**, lint/typecheck, build și **28 teste hosted fără skips** |
| Audit extins ulterior, rezultate și tabele | **245/245 interne, 62/62 browser local, 29/29 hosted**, lint/typecheck/build; încă 8/8 regresii finale locale și testul final recepție → portal → descărcare original → alt pacient refuzat |
| Browser local, audit final | 54 scenarii în suita completă: 53 au trecut, unul a detectat overflow la 320 px; după corecție au trecut toate cele 20 de regresii calendar/shell reluate, inclusiv cazul eșuat |
| Producție după audit | Șase verificări readiness, regiune UE, health, favicon și izolarea Stripe verificate |

Diferența istorică 53/54 + regresii a fost închisă prin rularea integrală nouă **62/62**, care include scenariile anterioare și cele adăugate în auditul extins. După ultima ajustare minoră CSS au mai trecut toate cele opt regresii specifice auditului. Nu este necesară repetarea testelor deja trecute fără o schimbare nouă care să o justifice.

Testele locale folosesc PostgreSQL/PGlite și fixture de protocol Auth; testele hosted verifică separat Supabase real, sesiuni, MFA, Storage, roluri, izolare, pilot și Stripe. Nu trebuie confundate cele două niveluri.

## 8. Starea locală Git — inițială și reconciliată

- Ramură activă: **`codex/stripe-sandbox`**.
- HEAD inițial, înaintea reconcilierii: **`2a8bcee` — `Integrate Voxa-OS subscriptions with Stripe sandbox`**.
- Checkout-ul păstrează modificările anterioare și cele ale auditului extins, inclusiv fișiere noi încă neurmărite. Nu presupune că release-ul publicat este identic cu HEAD-ul actual.
- Schimbările includ Stripe live, notificări, favicon, performanță/dialoguri/căutări, teste și documentația finală.
- Fișiere noi relevante: `docs/STRIPE_LIVE.md`, `docs/PERFORMANCE_AUDIT_2026-10-05.md`, capturile aferente, scripturile `stripe-live-*`, `notification-acceptance.mjs`, iconurile, loading-ul clinicii și teste pentru interacțiuni/MFA/Stripe.
- Istoricul recent conține deja SaaS/onboarding/landing, operațiuni Auth/email, R2, runner privat, MFA, restaurare, pilot sintetic, draft-uri juridice și Stripe sandbox.

**Reconciliere ulterioară:** snapshotul release-ului de la 03:12 a fost comparat cu checkout-ul complet. Toate cele 373 de fișiere executabile/asset/test/configurație coincid; diferențele ulterioare sunt numai documentație. Manifestul versionat leagă sursa de deployment-ul `dpl_9Bq6VhBjB2LT8NHJ2onmaWC6zgM2`, cu normalizarea LF/CRLF pentru verificarea pe alt sistem. Credentialele și chitanțele private rămân în directoarele ignorate. Identificatorul commitului se obține cu `git log -1 --format=%H -- docs/PRODUCTION_SOURCE_MANIFEST_2026-10-05.json`; relația cu remote și lista exactă sunt în raportul reconcilierii. Nu s-a făcut merge în `main`.

## 9. Ce mai rămâne — fără să redeschidem sarcini finalizate

### A. Închiderea tehnică a release-ului — reconciliată

1. Compararea cu release-ul, înregistrarea sursei și manifestului în Git și marcarea afirmațiilor istorice sunt finalizate în sarcina de reconciliere; nu le transforma din nou în implementări restante.
2. Verificările acelei sarcini sunt de sursă/Git/secrete/readiness, distincte de testele istorice 245/62/29. Nu se justifică repetarea suitei fără schimbări noi.
3. Dacă proprietarul dorește integrarea ramurii în `main`, urmează fluxul de review/merge fără force-push. Aceasta nu justifică o republicare sau modificarea aplicației live deja identice.
4. Confirmarea în Inbox a ultimei probe automate de notificare, dacă nu a fost confirmată între timp, și validarea politicilor clinicii pentru comunicări.
5. O verificare scurtă pe live a calendarului/formularului după Ctrl+F5, dacă utilizatorul mai reproduce întârzierea sau bugul. Nu prezenta problema deja reparată drept bug încă deschis fără reproducere nouă.

Acestea sunt recomandări rezultate din evidențele actuale, nu o declarație că integrarea Stripe sau auditul au eșuat.

### B. Backup — amânat explicit pentru 6 octombrie

- Observarea unei execuții reale de tip `schedule` a backupului privat și consemnarea rezultatului.
- Acord pentru retenție, RPO/RTO, eventual PITR/backup nativ și un responsabil pentru incidente.
- Verificarea versiunii fixate în runner față de schema curentă: nu presupune că runnerul urmărește automat codul nou.
- Plan de rotație a tokenului înainte de 2 ianuarie 2027.

Backupurile manuale, criptarea, transferul și restaurarea completă au trecut deja. **Nu cere refacerea lor de la zero și nu porni acest follow-up înainte de a fi reluat de proprietar.**

### C. Firma, oferta, Vercel și juridicul — responsabilitatea proprietarului

- Date firmă/CUI/adresă, oferta contractuală, TVA/fiscalitate/facturare și costuri.
- Activarea și confirmarea planului comercial Vercel ales. Nu este verificat ca activ în rapoarte.
- Finalizarea documentelor, DPA, furnizorilor, retenției, procedurilor și angajamentelor de suport.
- Responsabil de incidente și monitorizare dedicată dacă sunt cerute intervale garantate.

**Proprietarul a spus că le rezolvă personal.** În prompt pot apărea ca dependențe externe de lansare, nu drept muncă de implementat acum de agent.

### D. Pilot cu clinică reală — separat de lista curentă

- Pilotul tehnic sintetic complet este finalizat și verificat.
- O clinică reală trebuie să confirme durata serviciilor, bufferele, programul medicilor, cerințele de resurse, rolurile, comunicările și procedurile pentru documente/date.
- Un test cu date fictive nu dovedește finalizarea pilotului operațional pe date reale.
- Proprietarul a scos acest pilot din lista curentă; nu trebuie lansat automat.

### E. Funcții viitoare/opționale, care nu sunt sarcini aprobate pentru această etapă

- SMS printr-un provider nou sau WhatsApp Business automat, dacă sunt cerute.
- Voice AI/Retell/Telnyx — excluse explicit din versiunea curentă.
- Upload semnat pentru fișiere mai mari de limita interfeței.
- Scanare malware și procesare automată de retenție/ștergere, dacă sunt cerute și definite.
- Test de capacitate cu volume și concurență reprezentative, dacă este cerut un angajament de performanță pentru clinici mari.
- Integrare fiscală/facturare suplimentară după decizia proprietarului; Stripe Checkout nu dovedește singur rezolvarea tuturor cerințelor fiscale.

Nu transforma aceste posibilități într-un backlog obligatoriu numai pentru că există.

## 10. Documente importante pentru continuare

| Fișier | Ce explică |
| --- | --- |
| `AGENTS.md` | Regula documentației Next.js înainte de modificări |
| `MASTER_SPEC.md` | Cerințele originale și excluderea voice AI |
| `README.md` | Produs, setup, fluxuri și operare generală |
| `PRODUCTION_CHECKLIST.md` | Lista tehnică actuală și deciziile separate |
| `docs/PERFORMANCE_AUDIT_2026-10-05.md` | Ultimul audit, măsurători, teste și publicare live |
| `docs/DEEP_AUDIT_2026-10-05.md` | Auditul ulterior: tabele, rolul real al contului raportat, recepție, încărcare rezultate și portal, dovezi finale și publicare |
| `docs/RELEASE_RECONCILIATION_2026-10-05.md` | Starea găsită, inventarul exact, verificările executate în reconciliere și relația cu Git/producție |
| `docs/PRODUCTION_SOURCE_MANIFEST_2026-10-05.json` | Amprentele verificabile ale celor 373 de fișiere executabile/asset/test/configurație ale release-ului |
| `docs/STRIPE_LIVE.md` | Configurarea live și acceptanța actuală |
| `docs/SUBSCRIPTIONS.md` | Trial, abonament, expirare, licențe și billing |
| `docs/STRIPE_SANDBOX.md` | Configurarea și operarea sandbox |
| `docs/STRIPE_ACCEPTANCE_2026-10-04.md` | Dovezi istorice sandbox, anterioare verificării complete 3DS |
| `docs/NOTIFICATION_SCHEDULER.md` | Scheduler Supabase, activare și limite de livrare |
| `docs/TRANSACTIONAL_EMAIL_SETUP.md` | Brevo și emailurile tranzacționale |
| `docs/ACCOUNT_MFA.md` | MFA și procedurile de recuperare |
| `docs/ACCEPTANCE_1_4_2026-10-04.md` | Restaurare completă, MFA, pilot sintetic și probe email |
| `docs/PRIVATE_BACKUP_RUNNER.md` | Runner privat, schedule, chei și dovezi de backup |
| `docs/BACKUP_SETUP.md`, `docs/LAUNCH_OPERATIONS.md` | Backup și operațiuni de lansare |
| `docs/LEGAL_DRAFTS_RO.md`, `docs/LEGAL_OPERATIONS_RO.md` | Draft-uri și proceduri juridice |
| `docs/PROCESSORS_RO.md`, `docs/PRIVACY_OPERATIONS.md` | Furnizori și cereri privind datele personale |
| `docs/ARCHITECTURE.md` | Arhitectura și limitele funcționalităților |
| `docs/SAAS_IMPLEMENTATION_REPORT.md`, `docs/SUBSCRIPTIONS_IMPLEMENTATION_REPORT.md` | Etape istorice de implementare; unele restante au fost rezolvate ulterior |

**Ordinea de încredere pentru contradicții:** ultimele decizii explicite ale proprietarului → starea curentă observabilă → rapoartele din 5 octombrie și checklistul actual → rapoartele istorice. Păstrează diferența dintre „observat acum” și „confirmat într-un raport anterior”.

Exemple de afirmații istorice depășite: „Stripe este doar sandbox”, „3DS nu a fost verificat”, „notificările pacienților sunt oprite”, „MFA încă trebuie implementat”, „nu există restaurare completă”, „invitațiile sunt numai manuale”. Acestea au fost rezolvate în etapele ulterioare descrise aici. Draft-urile juridice și prima execuție programată a backupului privat rămân, în schimb, deschise/separate.

## 11. Cerințe pentru promptul final pe care îl vreau de la GPT

Scrie în română un prompt complet, gata de lipit în Codex. El trebuie:

1. Să precizeze că lucrăm în proiectul existent Voxa, cu arhitectura și datele actuale, fără rebuild sau înlocuirea stack-ului.
2. Să înceapă prin verificarea situației reale a ramurii, modificărilor neînregistrate și release-ului publicat.
3. Să transforme numai restantele tehnice relevante în acțiuni ordonate, fiecare cu criteriu de finalizare verificabil.
4. Să păstreze separat responsabilitățile mele și backupul/pilotul amânate, fără să le execute din presupunere.
5. Să nu ceară din nou implementarea Stripe live, MFA, onboardingului, notificărilor, faviconului sau corecțiilor din audit; să le verifice doar dacă următoarea schimbare o justifică.
6. Să ceară păstrarea multi-tenancy, RLS, MFA, permisiunilor pe rol și izolării sandbox/live.
7. Să interzică reseturi de producție, seed demonstrativ de producție, pierderea schimbărilor existente și expunerea secretelor.
8. Să ceară citirea ghidurilor Next.js locale relevante înainte de cod și modificări limitate la obiectiv.
9. Să ceară teste potrivite schimbării și un raport final cu ce s-a modificat, ce s-a verificat efectiv și ce depinde de mine.
10. Să distingă testele locale de hosted, SMTP de Inbox, live configurat de plată reală demonstrată și restaurare testată de SLA de recuperare.
11. Să nu declare conformitate juridică, absența tuturor bugurilor sau scalabilitate nelimitată pe baza testelor existente.
12. Dacă nu găsește o restantă tehnică justificată, să spună asta și să propună închiderea/reconcilierea release-ului, fără să inventeze funcționalități noi.

**Rezultatul cerut de la GPT:** o evaluare scurtă a restantelor reale, apoi un singur prompt final de execuție, concret și realist, adaptat acestei situații.
