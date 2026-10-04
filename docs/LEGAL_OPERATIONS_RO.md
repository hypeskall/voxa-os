# Operare, retenție și pregătire juridică — PROIECT

Versiune 2026-10-04.draft.1. Firma nu este încă înființată. Acest document nu atestă conformitatea și nu autorizează ștergeri, transferuri noi sau folosirea datelor medicale reale. Publicarea unui text nu înlocuiește procedurile, contractele și evaluarea activității reale.

Textele publice sunt în [LEGAL_DRAFTS_RO.md](LEGAL_DRAFTS_RO.md), generate din aceeași sursă ca `/legal`. Furnizori: [PROCESSORS_RO.md](PROCESSORS_RO.md). Dovezi tehnice: [ACCEPTANCE_1_4_2026-10-04.md](ACCEPTANCE_1_4_2026-10-04.md).

## Fișa de completat

| Element | Stare / acțiune |
| --- | --- |
| Firma, CUI, registru, sediu, reprezentant | Urmează constituirea; se completează din acte |
| Contact contractual și confidențialitate | contact@voxatech.ro este operațional; rolul și contactul juridic final de aprobat |
| Clinica și reprezentarea | Identificare și autoritate de semnare de verificat |
| Contact incident și înlocuitor | De desemnat pentru fiecare parte, cu program/escaladare |
| DPO | Evaluare motivată art. 37; nu este desemnat prin acest proiect |
| Preț total, TVA, conversie și suport | De aprobat înainte de comenzi plătite; Stripe rămâne ultima etapă |
| Hosting | Proprietarul a ales Vercel și va cumpăra personal planul comercial; activarea nu este verificată |
| MFA personal | Proprietarul a declarat activarea; testarea independentă privește factorul sintetic |
| RPO/RTO și retenție | Propuneri de aprobat, fără SLA inventat |

Informațiile [Legii 365/2002, art. 5](https://legislatie.just.ro/Public/DetaliiDocumentAfis/37075) se publică după completare. Identitatea actualului operator al conturilor de test trebuie clarificată; o firmă viitoare nu o înlocuiește retroactiv. Mutarea operațiunilor se documentează și se informează corespunzător.

## Registrul de prelucrări

Registru privat, cu versiune, responsabil și revizuire; fără nume de pacienți sau secrete în Git. Se disting registrul operatorului pentru scopurile proprii și registrul împuternicitului pentru fiecare clinică. Nu presupuneți excepția art. 30 numai din dimensiunea redusă a firmei, mai ales la prelucrare regulată de sănătate.

| Operațiune | Câmpuri necesare |
| --- | --- |
| Conturi / relație profesională | Scop, persoane, sursă, date, art. 6, destinatari, țări, termen/criteriu, garanții și control acces |
| Clinică / date medicale | Operator, DPA/instrucțiuni, scop și operațiuni autorizate, persoane/date, subcontractanți, țări, măsuri, restituire/ștergere |
| Portal activat de clinică | Operator identificat, informarea clinicii înainte de colectare, temei și necesitatea câmpurilor; termeni ai serviciului medical |
| Email / corespondență | Recipient, scop/temei, conținut minim, furnizor, metadata și termen; pacient automat dezactivat |
| Backup / recuperare | Captură în clar înainte de criptare, runner privat, R2 UE, cheia separată, acces, termen și ștergeri de reaplicat |

Pentru angajații unei firme client nu se folosește automat art. 6(1)(b) ca și când fiecare ar fi parte la contract. Documentați, după caz, interesul legitim, necesitatea și impactul. Clinica identifică separat art. 6 și condiția art. 9 pentru sănătate. Un checkbox „GDPR” nu înlocuiește această analiză; contul nu este condiționat de marketing.

## Propunerea de retenție

Termene de operare propuse, nu termene legale universale. Nu s-a activat ștergere medicală ori expirare R2. Păstrarea actuală fără automatizare este declarată în proiectul public; înainte de lansare se aprobă și se implementează un calendar verificabil.

| Categorie | Declanșator și propunere | Responsabil / excepții |
| --- | --- | --- |
| Conturi și clinici sintetice | Revizuire lunară; eliminare propusă la 30 zile după încheierea testului | Furnizor; păstrați numai dovezi agregate necesare |
| Cont / relație activă | Durata serviciului; fereastră asistată de restituire propusă de 30 zile la încetare | Părțile; conservări legale documentate |
| Audit / acces | Revizuire trimestrială; propunere 12 luni pentru securitate | Furnizor și clinică; auditul clinic poate avea obligații distincte |
| Logs tehnice la furnizori | Propunere 30 zile, verificată față de plan/configurație | Furnizor; conservare limitată pentru incident |
| Tichete de suport | Propunere 12 luni de la închidere; eliminați anexele inutile | Furnizor; litigiu documentat, fără dosar pacient în mail obișnuit |
| Dovezi cereri GDPR / incidente | Propunere 24 luni după închidere, cu minimizare și revizuire | Operator; justificarea și excepțiile de validat |
| Brevo / Zoho conținut și metadata | Termenul real din cont/contract de verificat; propunere 30 zile pentru conținut tranzacțional când setarea permite | Furnizor; nu declarați ștergere înainte de verificare |
| Backup zilnic | Propunere de fereastră rulantă 30 zile după existența copiilor bune și acceptarea obiectivelor | Furnizor; nicio expirare activată acum |
| Date / originale medicale | Termen pe tip de document și obligație aplicabilă, stabilit de clinică | Clinica; fără regulă generică de 30 zile |
| Evidențe financiar-contabile viitoare | Termenul legal aplicabil firmei/documentului, confirmat de contabil | Firma; fără regim TVA sau termen inventat |

Orice excepție consemnează scopul, datele, baza, aprobarea, izolarea, revizuirea și ridicarea măsurii. Nu conservați întregul dosar dacă sunt necesare numai dovezi limitate.

### Implementare după aprobarea termenelor

1. Inventar de tip, număr și vechime fără conținut în logs; verificați referințele Storage și copiile.
2. Simulare în staging sintetic: ce se elimină și ce se conservă. Clinica aprobă retenția medicală; furnizorul pe cea operațională.
3. Verificați o copie bună restaurabilă, cheile și conservările justificate înainte de orice regulă de expirare R2.
4. Executați numai instrucțiunile aprobate, pe categoria corectă, cu drepturi minime. Absența unei instrucțiuni nu autorizează ștergere.
5. Verificați PostgreSQL/Auth, originale/derivate, outbox, furnizori și backupuri. Atestare cu identificatori minimali, nu copii ale datelor șterse.
6. Testați restaurarea unui punct anterior ștergerii: reaplicați ștergerile/restricțiile înainte de acces și înainte de notificări.

## Cereri GDPR

1. Înregistrați data primirii, ID intern, canal, operator, drept și termen. Nu cereți dosarul medical prin email.
2. Stabiliți rolul: pentru date medicale, transmiteți clinicii fără întârziere; pentru date proprii de cont, operatorul Voxa gestionează direct. Transmiterea internă nu resetează termenul.
3. Verificați proporțional identitatea/reprezentarea pe un canal cunoscut când este posibil. Nu cereți automat copie integrală CI sau CNP; în caz de îndoială motivată, numai informația necesară.
4. Localizați sursele, versiunile, fișierele și destinatarii. JSON-ul de export conține metadate; originalele se livrează separat. Protejați datele altor persoane.
5. Operatorul decide limitele legale, retenția și restricțiile. Arhivarea nu este ștergere; redenumirea nu anonimizează documentele.
6. Răspuns fără întârziere, de regulă în cel mult **o lună**. Prelungirea cu cel mult două luni în condițiile art. 12 se motivează și comunică în prima lună; nu înlocuiți automat „o lună” cu „30 zile”.
7. Executați instrucțiunea, verificați și atestați. UI-ul „finalizat” nu șterge automat. Refuzul motivat include drepturile de plângere/cale de atac.

Fișă privată: `ID | primit la | operator | drept | verificare minimă identitate | surse | termen | prelungire motivată | instrucțiune | executant | verificare | răspuns | închis | revizuire retenție`. Nu introduceți datele efective în Git.

## Incidente și breșe

O alertă „eroare de server” nu dovedește o breșă. Emailul de test confirmat a fost intenționat. Evaluați distinct confidențialitatea, integritatea și disponibilitatea.

1. Consemnați detectarea și luarea la cunoștință, serviciul, clinicile/datele posibil afectate, responsabilul și înlocuitorul.
2. Limitați accesul/sesiunile/cheile și conservați controlat probele. Nu transmiteți conținut medical în alerte sau chat public.
3. Împuternicitul informează operatorul **fără întârzieri nejustificate**. 24 ore este ținta propusă a primei informări, nu dreptul de a aștepta sau un SLA existent.
4. Operatorul evaluează art. 33–34: autoritatea se notifică în cel mult 72 ore de la luarea la cunoștință când condițiile art. 33 sunt îndeplinite, cu motivarea întârzierii; risc ridicat implică informarea persoanelor fără întârzieri nejustificate în condițiile art. 34. Informațiile pot fi furnizate etapizat. Se documentează și decizia motivată de a nu notifica.
5. Comunicați faptele confirmate, amploarea estimată, consecințele, măsurile, contactul și ce rămâne în investigare. Nu afirmați prematur că datele sunt neafectate.
6. Recuperați dintr-un punct verificat, reaplicați ștergeri/restricții și evitați retrimiterea mesajelor deja acceptate. Verificați permisiuni, integritate, cauză și măsuri preventive.

Fișă privată: `ID | detectat | luat la cunoștință | rol | tip/amploare | risc și raționament | limitare | informare clinică | notificări/decizii | actualizări | recuperare | cauză | măsuri | responsabil | închis`. Nu este contractat un responder 24/7 prin această fișă.

## DPIA, DPO și transferuri

Înainte de date reale, documentați analiza art. 35/37 GDPR și [Deciziei ANSPDCP 174/2018](https://legislatie.just.ro/public/detaliidocument/206331): sănătate, vulnerabilitate, volum/extindere, portal, acces, combinarea surselor, transferuri și efectul incidentelor. Nu presupuneți aceleași obligații pentru toate clinicile ori o excepție automată pentru clinică mică.

DPIA: fluxuri, necesitate/proporționalitate, riscuri pentru persoane, măsuri/verificări, risc rezidual, consultări și decizia operatorului. Împuternicitul asistă. Dacă riscul rezidual impune consultarea art. 36, nu începeți prelucrarea dependentă înainte de procedură. Motivați separat necesitatea DPO și desemnarea/contactul real.

Evaluarea transferului: date, destinatar/entitate, țări și suport, mecanism art. 44–49, contract și măsuri suplimentare. Verificați exact domeniul unei decizii de adecvare. Frankfurt nu garantează exclusiv UE; criptarea R2 nu ascunde datele de serviciile care le procesează înaintea criptării.

## Pilotul cu prima clinică

Este o clinică reală care testează cu personalul său. Prima fază poate folosi date fictive, fără migrarea pacienților. Invitația în aplicație nu semnează contractul comercial ori DPA.

Etapa cu date reale necesită: entități/reprezentare, documente/temeiuri, DPA/anexe, informarea pacienților și portalului, evaluări/furnizori/transferuri, retenție și continuitate, contacte incidente, hosting comercial activ și instruire. Verificați proprietarii, rolurile medicilor și exportul; conveniți oprirea/escaladarea pilotului. Pacientul automat rămâne dezactivat până la o verificare distinctă a scopului, mesajului, adreselor și programării.

## Publicare și acceptare finală

- Completați identitatea, oferta, termenele, anexele și revizuirea juridică pentru activitatea concretă. Textele trebuie să reflecte produsul, inclusiv limitele ștergerii.
- Arhivați privat contractele/DPA-urile efective și evaluările; o pagină web a furnizorului nu dovedește contractul încheiat pentru firma potrivită.
- Analizați natura profesională reală a relației. Pentru o ofertă către consumatori, pregătiți distinct informarea precontractuală, drepturile aplicabile, retragerea și pictograma/informarea SAL potrivit formei în vigoare. Un proiect ANPC în consultare nu este act adoptat.
- Publicați o versiune finală datată numai după completare/aprobare; păstrați versiunile. Implementați apoi acceptarea cu versiune, moment și reprezentare. Nu înregistrați acceptarea termenilor nefinalizați; citirea informării GDPR nu este consimțământ medical.
- Nu publicați „100% legal compliant”, „certificat GDPR” ori „aprobat ANPC” pe baza acestor pagini. Conformitatea depinde și de operațiunile reale.

## Surse primare verificate la 4 octombrie 2026

- [GDPR](https://eur-lex.europa.eu/legal-content/RO/TXT/?uri=CELEX:32016R0679), text și la [ANSPDCP](https://www.dataprotection.ro/servlet/ViewDocument?id=1262).
- [Legea 365/2002](https://legislatie.just.ro/Public/DetaliiDocumentAfis/37075), [Legea 506/2004](https://legislatie.just.ro/Public/DetaliiDocumentAfis/214211), [OG 38/2015](https://legislatie.just.ro/Public/DetaliiDocumentAfis/234807).
- [ANSPDCP — plângeri](https://www.dataprotection.ro/index.jsp?lang=ro&page=procedura_plangerilor), [ANPC — SAL](https://reclamatiisal.anpc.ro/).
- [Regulamentul 2024/3228](https://eur-lex.europa.eu/legal-content/RO/TXT/?uri=CELEX:32024R3228) — abrogarea SOL cu efect de la 20 iulie 2025.
- [ANPC — proiectul de modificare a Ordinului 449/2022, consultare 8–17 aprilie 2026](https://anpc.ro/modificare-a-ordinului-presedintelui-autoritatii-nationale-pentru-protectia-consumatorilor-nr-449-2022-privind-placheta-sal-publicat-in-monitorul-oficial-partea-i-nr-725-din-19-iulie-2022/). Nu este tratat ca act adoptat; forma aplicabilă se confirmă la finalizarea modelului și firmei.
