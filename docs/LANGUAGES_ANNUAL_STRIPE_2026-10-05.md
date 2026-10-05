# Limbi și abonament anual — 5 octombrie 2026

## Schimbări

- Site-ul, platforma și portalul au selector persistent pentru română, engleză, germană, franceză, spaniolă, italiană și polonă. Alegerea explicită are prioritate față de preferința browserului.
- Traducerile interfeței sunt incluse în aplicație; serverul încarcă numai catalogul limbii alese. Nu se trimit date ale pacienților sau clinicilor la un serviciu de traducere în timpul utilizării.
- Cataloagele au fost generate inițial cu Google Translate, cu acord explicit pentru textele statice, apoi au fost corectate pentru termeni importanți și variabile. Conținutul introdus de utilizatori rămâne original; textele juridice păstrează statutul de proiect pentru revizuire.
- Plan lunar: **19,99 EUR/lună**. Plan anual: **149,99 EUR/an**, plătit integral, economie **89,89 EUR/an (37,5%)** față de 12 plăți lunare.
- Alegerea planului apare pe site și înainte de Checkout. Prețurile sunt alese și validate pe server; browserul nu stabilește suma. Schimbarea alegerii înainte de plată expiră sesiunea Checkout veche.
- Stripe Checkout și portalul de facturare folosesc limba aleasă. Abonamentele existente își păstrează perioada și prețul; portalul permite facturi, actualizarea metodei de plată și anulare la finalul perioadei. Schimbarea intervalului unui abonament deja activ nu este oferită prin portal.
- Webhookurile validează prețul anual configurat, suma de 14.999 eurocenți, intervalul anual, clientul, organizația și încasarea efectivă înainte de accesul plătit. Revenirea din Checkout nu acordă acces singură.
- Migrarea `202610050042_annual_billing.sql` permite planul anual, păstrând controlul de acces, blocarea concurenței și deduplicarea evenimentelor.
- `scripts/stripe-annual-setup.mjs configure [staging]` configurează idempotent prețul anual și variabila serverului `STRIPE_ANNUAL_PRICE_ID`, în contul și mediul nominalizate, fără debitări.

## Verificări efectuate

- 12 verificări relevante pentru validarea Stripe, izolarea accesului, persistența planului anual, alegerea limbii și integritatea cataloagelor/variabilelor.
- Un flux local de browser: șapte limbi pe site, păstrarea alegerii, păstrarea sesiunii și a datelor pacientului în platformă.
- Un flux Stripe anual pe staging: Checkout cu suma corectă, încasare prin metoda oficială de test, webhook, acces pe un an, portal, anulare, semnătură invalidă și deduplicare.
- Intrarea automatizată a cardului în Checkout este limitată de CAPTCHA Stripe; plata a fost verificată prin API-ul oficial sandbox. Nu a fost efectuată o debitare reală.
- Tipurile și compilarea de producție au trecut. Nu s-a reluat întreaga suită istorică.
- Migrarea 42 a fost aplicată și verificată pe staging, apoi pe producție după un backup criptat și verificat prin decriptare (80 tabele și 2 fișiere Storage).

Publicarea și commitul final sunt consemnate în manifestul de producție și în istoricul Git.

## Publicare finală

- Commit implementare: `3e6c62069b51e99649f80d71ec6e2a928d3a5706`, push efectuat pe `codex/stripe-sandbox`.
- Producție: `dpl_CBhKPzZvCScwMok1qwawLqkivCuS`, READY.
- Manifest: 397 fișiere ale sursei corespund versiunii publicate; zero diferențe runtime și zero chei detectate în surse.
- Pagina publică a fost verificată prin răspunsurile HTML reale în toate cele șapte limbi, inclusiv prețul anual și prioritatea alegerii persistente față de limba browserului.
