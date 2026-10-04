# Furnizori, date și transferuri — registru pentru completare

Proiect 4 octombrie 2026. Descrie configurația actuală, fără a certifica semnarea contractelor sau transferurile. Păstrați privat entitatea exactă, DPA-ul efectiv, versiunea/data, țările și suportul, mecanismul de transfer, evaluarea și notificările. Fără chei, pacienți sau contracte confidențiale în Git.

| Serviciu | Date / acces actual | Localizare și limite | Dovadă necesară |
| --- | --- | --- | --- |
| Supabase | DB/Auth/Storage, conturi/factori, date și fișiere medicale, audit | Proiecte Frankfurt; suport/subcontractanți separat | DPA, listă, acces suport, țări, transferuri, ștergere |
| Vercel | Cereri, execuție server, autentificare/fișiere la cerere, IP/logs | DPA descrie SUA și alte locații; nu exclusiv UE | Plan comercial activ, DPA, listă, execuție/logs, retenție, transferuri |
| Brevo | Recipient, conținut Auth/invitație, referință alertă, metadate | Verificare față de cont/condiții efective | DPA din Terms, subcontractanți, retenție, notificări |
| Cloudflare R2 | Arhive criptate; cheia separat | Obiecte în jurisdicție UE; metadate/control-plane și suport separat | DPA, listă, garanții, acces, retenție |
| GitHub Actions privat | Date citite temporar înaintea criptării; chei limitate și criptare în secrete private | Runnerul nu este declarat UE; accesul în clar este relevant | Termeni/DPA ai contului, subcontractanți, locație, log/runner lifetime, garanții |
| Zoho | Mailbox contact@voxatech.ro, suport/admin | Nu SMTP automat; regiunea contului de verificat | Contract/DPA, acces, termen, transferuri, reguli atașamente |
| Stripe | Integrat numai sandbox pe staging protejat; date sintetice | Checkout abonamente, portal și facturi de test; fără date medicale/pacient, plăți live sau colectare taxe | Roluri/entități, informare, contract, transferuri, ofertă fiscală și retenție de aprobat înainte de live |

Fișă privată: `serviciu | entitate | rol/scop | persoane/date | clar/criptat | țări/suport | subcontractanți | DPA efectiv + dată/versiune | mecanism/domeniu transfer | evaluare/măsuri | retenție reală | eliminare/restituire | incident/contact | schimbări | proprietar | revizuire | decizie/dovadă`.

Un DPA pe web nu dovedește încheierea contractului. Mutarea conturilor la firma nouă cere verificarea părților. Nu publicați o listă completă de țări fără evaluare.

## Controale și limite

- Codul public nu conține datele clinicilor. Runnerul privat folosește sursă fixată la commit și instalează dependențele înainte de secrete; parola SMTP și cheia generală de administrare Supabase nu sunt exportate acolo.
- Captura citește date în clar înainte de criptare. R2 primește AES-256-GCM în bucket privat, cu verificare prin redescărcare. Aceasta nu elimină evaluarea procesării în runner.
- Nu sunt publicate arhive/configurări private ca artefacte ori cache GitHub; configurările temporare sunt eliminate. Logs și politicile platformei se verifică în contract, fără promisiuni inventate.
- Brevo trimite tranzacțional; contactul folosește Zoho. Pacientul automat este dezactivat; alertele nu includ conținut clinic.
- Codul verificat nu include tracking publicitar/analytics de vizitatori; fonturile sunt locale. Opțiunile viitoare de hosting se inventariază separat.

## Surse oficiale

- [Supabase DPA](https://supabase.com/legal/customer-resources/data-processing-addendum), [lista Supabase](https://supabase.com/legal/customer-resources/subprocessor-list).
- [Vercel DPA](https://vercel.com/legal/dpa).
- [Brevo — localizarea DPA](https://help.brevo.com/hc/en-us/articles/15403782599570-Where-can-I-find-the-Data-Processing-Agreement-DPA).
- [Cloudflare DPA](https://www.cloudflare.com/cloudflare-customer-dpa/).
- [GDPR, capitolul V](https://eur-lex.europa.eu/legal-content/RO/TXT/?uri=CELEX:32016R0679).

Contractele GitHub/Zoho ale conturilor trebuie obținute/evaluate. Nu este consemnată o acceptare în numele firmei care nu există încă.
