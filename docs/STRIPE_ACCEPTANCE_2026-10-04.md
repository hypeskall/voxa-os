# Acceptanță Stripe sandbox — 4 octombrie 2026

**Raport istoric.** Limitarea CAPTCHA/3DS de mai jos descrie proba inițială. Checkout cu card și 3DS a fost verificat ulterior, iar configurația live a fost activată pe 5 octombrie; vezi [acceptanța ulterioară](STRIPE_LIVE.md). Dovezile originale nu sunt rescrise ca și când proba inițială ar fi demonstrat aceste etape.

Integrare pentru abonamentele organizațiilor Voxa-OS, 19,99 EUR/lună, în aplicația existentă. Planificatorul pluginului Stripe este disponibil în sesiunea nouă; planul a fost generat și acceptat. [Plan și operare](STRIPE_SANDBOX.md).

Mediu verificat: [staging protejat](https://voxa-os-staging-voxa6.vercel.app), Supabase dedicat `wlnrfjrjkyywqyvsngps`, cont Stripe „Voxa Tech sandbox”, test. Producția nu a fost migrată sau publicată în această etapă. Cheile și credentialul webhook-ului sunt în fișiere ignorate și variabile sensibile pe server; scanarea fișierelor pentru Git nu a găsit chei Stripe reale.

| Verificare | Rezultat |
|---|---|
| Suite locale, securitate/MFA, trial/licențe, semnături și idempotență | 228 teste reușite |
| Verificare tipuri și lint | Reușite |
| Build local și Preview Vercel | Reușite |
| Schema hosted staging | 39 migrații, 1459 verificări structurale reușite |
| Regresie browser pentru pagini comerciale, facturare/licență și documente juridice | 6 teste reușite |
| Inițiere Checkout din aplicație, preț/cantitate/mod test, redirect fără acordarea accesului | Reușite |
| Plata cu PaymentMethod oficial de sandbox și webhook Stripe real | Reușite; accesul se activează pe server |
| Portal în browser, anulare la finalul perioadei și închiderea abonamentului | Reușite |
| Evenimente duplicate/mai vechi și semnătură invalidă | Reușite; fără dublarea istoricului sau revenirea la o stare veche |
| Refuz plată, recuperare și rambursare | Reușite; accesul urmează plata validată |
| Eveniment live semnat valid | Respins cu HTTP 400 |
| Tenant străin și apel RPC de server din cont OWNER | Fără acces; RPC refuzat |
| Emitere, activare și revocare licență prin PostgREST real | Reușite; trial inițial păstrat |
| Stripe Tax | Colectare dezactivată; lista înregistrărilor active sandbox este goală |

Toate testele Stripe hosted folosesc o organizație sintetică separată, fără pacienți sau documente medicale. Abonamentele de probă și licența au fost închise/revocate la final. Nu s-au trimis mesaje către pacienți.

Introducerea automată a cardului în Checkout a fost blocată de CAPTCHA Stripe. Nu a fost ocolit controlul. Sesiunea Checkout de probă a fost expirată înainte de plata separată prin API-ul oficial; finalizarea Checkout și 3DS în browser nu sunt declarate verificate. Acestea necesită o probă manuală înainte de live.

Firma, oferta finală/TVA, contractele și înregistrările fiscale reale rămân de completat; plățile reale și colectarea taxelor nu sunt activate. Documentele publice și exportul juridic au fost actualizate ca proiect `2026-10-04.draft.2`, fără a declara termeni finali sau conformitate integrală.
