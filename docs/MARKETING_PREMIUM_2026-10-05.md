# Site de prezentare Voxa-OS — 5 octombrie 2026

## Audit și plan

Proiectul folosește Next.js 16.3.6, React 19, Noto Sans, Lucide, componente Radix/shadcn și un stylesheet separat pentru marketing. Aplicația clinică are propriile module, permisiuni, autentificare și billing. La începutul lucrului, `package.json` și lockfile-ul aveau deja modificări pentru shadcn; acestea au fost păstrate.

Site-ul avea șase pagini publice, un tur interactiv cu capturi reale, meniu mobil modal, traduceri și linkuri funcționale către cont și documentele legale. Pagina principală se limita la hero, legături către pagini și un CTA. Capturile din `public/marketing` sunt interfața reală a aplicației, cu date demonstrative; nu au fost înlocuite cu dashboard-uri inventate.

Plan implementat:

1. Păstrarea identității Voxa, a rutelor și a comportamentului conturilor existente.
2. Landing page complet: hero, problema clinicilor, explicație Voxa-OS, module, tur real, flux pacient/programări, ROI, securitate, preț, FAQ și CTA.
3. Tokens vizuale, tipografie, spațiere, navigație și componente publice reutilizabile; responsive de la 320 px.
4. Animații discrete și verificări de producție, browser și regresie.

## Implementare

- Hero cu taburi Calendar / Dashboard / Pacient, control din tastatură și captură completă într-un dialog. Pe telefon, zona de lucru este vizibilă inițial, iar captura rămâne derulabilă în propriul cadru.
- Ajustările finale aprobate păstrează hero-ul centrat: badge-ul de deasupra titlului a fost eliminat, iar preview-ul are maximum 820 px în loc de 1080 px, cu spațiere mai compactă.
- Turul real existent păstrat, inclusiv pauză, reluare, oprire în afara viewport-ului și la ascunderea tabului.
- Grile compacte cu iconografie Lucide, secțiuni luminoase și accente verde închis; fără testimoniale, logo-uri de clienți sau certificări inventate.
- Calculator ROI: programări/zi × minute alese × 22 zile / 60. Rezultatul este declarat estimativ, nu o statistică de performanță a produsului.
- Componentă de preț publică reutilizată pe homepage și `/pret`, cu 19,99 EUR/lună implicit și opțiunea existentă de 149,99 EUR/an; 30 de zile fără card. Billing-ul platformei nu a fost modificat.
- Motion Mini pentru reveal și stagger, cu animații pe transform/opacity, fără listener de scroll per frame. Documentația consultată: [Motion](https://motion.dev/docs/inview). Reducerea mișcării oprește reveal, intrările și camera turului. Reveal-ul este activat doar după inițializarea clientului; markup-ul serverului nu este ascuns de efecte.
- SEO: titlu și indexare publică păstrate, descriere actualizată și metadate Open Graph/Twitter. Structură semantică, un singur H1, skip link, focus vizibil și dialoguri native.
- Stilurile sunt limitate la `.marketing-page`; nu s-au modificat modulele clinice, baza de date, permisiunile, Stripe sau autentificarea.

## Instrumente

MCP shadcn: registrul, exemplul de accordion și checklist-ul de audit au fost consultate. FAQ-ul nativ accesibil a fost păstrat pentru a evita o dependență suplimentară. Context7, Playwright MCP, GitHub MCP, Vercel MCP și Supabase MCP nu erau disponibile în sesiune. Au fost utilizate documentația Next.js instalată, Git local și Playwright/Edge instalat în proiect. La cererea utilizatorului, versiunea aprobată a fost publicată pe `main` în commit-ul `62ea9bd`; actualizarea site-ului Vercel a fost verificată prin răspunsul public HTML/CSS.

## Verificări

- Build de producție, TypeScript și ESLint.
- 14 verificări Playwright pentru site, navigație, limbi, tur, meniu mobil, preview, calculator, pricing și fluxurile existente de cont/abonament/licență. Problemele detectate în prima rulare au fost corectate și testele afectate au trecut la reluare.
- Toate cele șapte rute publice la 1440, 1280, 1024, 768, 390 și 320 px. Fără overflow orizontal al documentului; capturile ample se derulează în cadrele proprii.
- Capturi revizuite pentru desktop, laptop, tabletă și telefon; meniuri, hover, tastatură, scroll reveal, preferința pentru mișcare redusă și încărcarea imaginilor.
- Nicio eroare JavaScript observată în verificările publice.

Capturile locale se află în `test-results/marketing/premium/` (folder ignorat de Git). Rulările de browser folosesc datele fictive din fixture-ul local, nu date de producție. Capturile sunt verificări de layout; nu reprezintă un benchmark de 60 fps pe toate dispozitivele. Nu s-au evaluat certificări sau conformitatea juridică a platformei.

Verificarea suplimentară fără JavaScript a confirmat că textul complet este în HTML, dar infrastructura existentă `src/app/loading.tsx` transmite pagina prin streaming și folosește JavaScript pentru a înlocui ecranul de încărcare. Un browser cu JavaScript complet dezactivat rămâne pe acel ecran. Această limitare preexistentă nu a fost schimbată, pentru a păstra comportamentul aplicației. Verificările interactive și vizuale de mai sus folosesc JavaScript activ.

## Contact

Secțiune nouă după FAQ, în aceeași identitate vizuală, cu datele furnizate de utilizator: +40 770 541 817 (`tel:`), contact@voxatech.ro (`mailto:`), Oradea, România. Linkuri exacte către Facebook, TikTok și Instagram, cu iconuri de brand și deschidere în tab nou. Meniurile desktop/mobil și footer-ul trimit la `/#contact`.

Navigarea din altă pagină a expus o limitare a alinierii fragmentului URL înainte de montarea secțiunii transmise prin streaming. Componenta Contact aliniază fragmentul după montare, fără timere sau schimbări ale infrastructurii platformei. Testul existent de navigație acoperă acum acest caz.

Verificat la 1440, 1280, 1101, 1024, 768, 390 și 320 px: fără overflow orizontal, meniu mobil, linkuri de contact/socials, focus de tastatură, acces direct prin fragment și mișcare redusă. Capturile finale sunt în `test-results/contact/`. Testul de navigație, build, typecheck și lint au trecut.
