# Abonamente Voxa-OS — Stripe sandbox

Plan generat și acceptat cu pluginul Stripe (`stripe_implementation_planner`) în 4 octombrie 2026, ghid `iguide_61VWH7PtMtA4bbT0C41BMgXVxmUfp`. Cont: Voxa Tech sandbox, `acct_1Tvn7oBMgXVxmUfp`, `livemode=false`. Nu a fost necesar fallbackul skills.

## Planul integrării

- Checkout Stripe găzduit, `mode=subscription`, un singur Price de 1999 cenți EUR/lună, cantitate 1/organizație, billing mode flexible.
- Trialul local de 30 zile fără card la înscriere rămâne neschimbat. La abonare anticipată, Stripe folosește data de expirare inițială, fără un trial nou. În ultimele 48 ore se așteaptă expirarea înainte de crearea unui Checkout nou, deoarece Stripe cere minimum două zile pentru `trial_end`.
- Portal Stripe pentru facturi, date de facturare, metoda de plată și anulare la finalul perioadei. Planul nu poate fi schimbat din portal.
- Facturile abonamentului sunt generate de Stripe Billing. Nu se facturează pacienți sau proiectele software Voxatech.
- Smart Retries/recovery se configurează în Dashboard înainte de lansarea comercială; setările nu sunt declarate verificate prin acest cod. Nu se activează emailuri automate către pacienți.
- Stripe Tax: colectare dezactivată explicit. Categoria fiscală finală, sediul, regimul prețului/TVA și înregistrările se confirmă din date reale înainte de implementarea live. Testele nu dovedesc monitorizarea pragurilor fiscale live.
  Lista înregistrărilor active a fost verificată prin MCP în sandbox și este goală; nu au fost create înregistrări fiscale.

Referințe: [abonamente](https://docs.stripe.com/billing/subscriptions/build-subscriptions?payment-ui=checkout&ui=stripe-hosted), [webhooks](https://docs.stripe.com/billing/subscriptions/webhooks), [portal](https://docs.stripe.com/customer-management/integrate-customer-portal), [Tax](https://docs.stripe.com/tax/registering).

SDK oficial `stripe@23.0.0`, verificat în registry; versiunea API inclusă și fixată explicit: `2026-09-30.endive`. Versiunile mai vechi din skill au fost înlocuite cu versiunea stabilă curentă.

## Autoritate și acces

Doar OWNER poate iniția Checkout și portal, conform regulii existente. `requireOrganization` verifică utilizatorul, organizația și MFA înainte de orice operație Stripe. ADMIN/RECEPTION/DOCTOR nu primesc acces suplimentar la facturare.

Cheia trebuie să fie test, contul verificat trebuie să coincidă, iar `APP_ENVIRONMENT` trebuie să fie `staging`. În producție integrarea rămâne dezactivată, inclusiv dacă cineva setează accidental flagul. Nu există cheie publică în browser: Checkout este găzduit, iar toate apelurile folosesc serverul.

Mappingul customer–organizație este creat de server, unic și protejat prin RLS/MFA; metadata primită singură nu autorizează o organizație. Lease-urile și RPC-urile de sincronizare sunt accesibile numai `service_role`. Licențele existente rămân funcționale; abonarea este blocată cât timp o licență este activă, iar un webhook nu îi suprascrie accesul.

Webhook-ul `/api/stripe/webhook` verifică semnătura pe corpul original, timestampul și modul test. Evenimentele relevante provoacă o citire a stării actuale Stripe sub un lease per organizație. Evenimentele duplicate sunt deduplicate în tranzacția care actualizează accesul și istoricul. La eroare răspunde 500 pentru retry Stripe; metadata, redirectul de succes și starea din browser nu acordă acces.

Accesul plătit cere plan/cantitate/monedă corecte, abonament activ, factura plătită pentru exact perioada itemului și un charge Stripe reușit, nerambursat și fără dispută. Perioada este delimitată, inclusiv `cancel_at`; la neplată nu se acordă o perioadă nouă. Refundurile/disputele revalidează plata; pentru cazuri istorice se impune revizuire operațională înainte de live.

## Configurare și operare

Variabilele server sunt exemplificate în `.env.staging.example`. Preferința este o restricted test key cu permisiuni minime pentru cont/balance read, Products/Prices read, Customers read/write, Checkout Sessions read/write, Subscriptions read, Invoices/Invoice Payments/PaymentIntents/Charges read, Billing Portal sessions write. Configurarea inițială a catalogului/portalului/webhookului are nevoie separat de permisiuni write de operator.

`scripts/stripe-sandbox-setup.mjs` citește fișierul de chei furnizat fără să îl afișeze, verifică sandboxul și salvează configurația doar în `.env.staging.local`, ignorat de Git. Nu trimite cheile în argumente CLI. Fișierul inițial de pe Desktop nu este modificat. Cheile trebuie păstrate privat și mutate într-un secret store/sensitive env; rotiți cheia la orice expunere. Nicio variabilă Stripe secretă nu trebuie să aibă prefixul `NEXT_PUBLIC_`.

Staging rămâne protejat. Webhookul înregistrat conține credentialul dedicat Vercel protection bypass în URL; acesta este secret, nu se afișează/publică în Git. Nu se copiază în producție. Se revocă din proiectul staging și se dezactivează endpointul Stripe atunci când testarea este retrasă. Verificarea Stripe a semnăturii rămâne obligatorie chiar dacă accesul Vercel este valid.

`scripts/stripe-staging-release.mjs configure` sincronizează numai variabilele Stripe ale proiectului `voxa-os-staging`, ținta Preview, cu secrete sensibile. `deploy` creează un snapshot ignorat, publică Preview și mută numai aliasul staging. Migrațiile se aplică cu fluxul staging existent; fără reset/seed în producție.

Nu există ștergere automată a evidențelor de facturare. Retenția fiscală, exporturile, reconcilierea, tratarea disputelor și responsabilul operațional se stabilesc înainte de live.

## Verificări

Suitele locale acoperă izolarea tenantului, OWNER/MFA, interzicerea scrierilor din browser, lease expirat/simultan, tranzacții/idempotență, perioade plătite, trial inițial și licențe manuale. Pe staging au fost verificate inițierea Checkout din aplicație, plata prin API-ul oficial de sandbox cu PaymentMethod sintetic, webhook-ul real `invoice.paid`, accesul după plată, portalul în browser, anularea la finalul perioadei și încetarea, semnătura invalidă, retrimiterea evenimentului plătit după anulare programată și lipsa accesului între organizații.

Testul suplimentar a confirmat refuzul plății inițiale (`pm_card_chargeCustomerFail`), lipsa accesului înainte de plată, recuperarea facturii cu un PaymentMethod valid, activarea prin webhook și retragerea accesului după rambursare. Un eveniment cu semnătură validă, dar `livemode=true`, este respins. Ambele scenarii de staging au trecut, iar abonamentele sintetice au fost anulate.

Emiterea, activarea și revocarea unei licențe manuale au fost verificate suplimentar prin Auth/PostgREST real pe aceeași organizație sintetică, după anularea Stripe. Migrația de compatibilitate citește rolul server din `request.jwt.claims` pentru RPC-urile administrative de licență, păstrând și fallbackul vechi; nu modifică regulile comerciale. Licența de probă a fost revocată.

Introducerea cardului în pagina Stripe găzduită nu a putut fi verificată automat deoarece Stripe a prezentat CAPTCHA în cadrele sale securizate. Nu s-a ocolit această verificare. Testul folosește numai inițierea Checkout în browser; sesiunea este expirată înainte de plata separată prin API. Introducerea cardului, 3DS și finalizarea Checkout rămân de verificat manual înainte de live. Această limitare este înregistrată separat de testele backend reușite.

Fixture-ul de acceptanță este o organizație sintetică separată, fără pacienți/documente medicale. Abonamentele sale sunt închise la finalul testelor, iar credentialele și chitanțele tehnice sunt numai în `.staging-deploy`, ignorat de Git.

## Înainte de plăți reale

Firma/CUI/adresa, oferta finală și TVA, contractele/informările, înregistrările fiscale necesare, planul comercial de hosting și configurația recovery trebuie confirmate. Live necesită o schimbare explicită a protecțiilor din cod și o verificare separată cu chei/endpoint/Price live; simpla înlocuire a cheii este respinsă. Stripe Tax nu se activează înainte de verificarea sediului și înregistrărilor active.
