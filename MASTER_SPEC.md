Construiește de la zero o aplicație complet nouă numită VOXA OS.

NU este un refactor al unei aplicații existente.
NU folosi și NU copia arhitectura veche făcută în Antigravity.
Vreau o implementare fresh, bine structurată, scalabilă și production-ready.

Aplicația trebuie să fie un software B2B serios de management pentru clinici medicale mari.

IMPORTANT
Nu ne ocupăm momentan de AI receptionist  voice agent.
Nu implementa Retell, Telnyx, voice AI sau funcții similare.
Arhitectura poate fi pregătită pentru integrări viitoare, dar acestea NU fac parte din această versiune.

Obiectivul este să construim fundația serioasă a Voxa OS
- calendar medical central
- programări
- pacienți
- medici
- cabinete
- serviciiinvestigații
- echipamente
- programări online de pe site
- confirmări
- remindere
- documente medicale
- rezultate
- portal pacient
- administrare clinică
- permisiuni
- audit
- configurare

Aplicația trebuie să fie COMPLET FUNCȚIONALĂ.

Nu vreau
- demo UI
- mock data ca funcționalitate finală
- butoane fără acțiune
- pagini decorative fără backend
- fake availability
- date hardcodate
- funcții simulate

Toate acțiunile importante trebuie să funcționeze end-to-end și să persiste corect în baza de date.

========================================================
1. DIRECȚIA VIZUALĂ
========================================================

Voxa OS trebuie să arate ca un produs B2B premium pentru o clinică medicală mare.

NU trebuie să arate ca un proiect vibe coded.

Evită complet stilul generic AI SaaS.

NU folosi
- culori neon
- combinații movalbastru specifice aplicațiilor AI
- gradienturi agresive
- glow-uri
- glassmorphism excesiv
- carduri enorme cu border-radius exagerat
- fiecare element pus într-un card
- emoji-uri în interfață
- iconițe inutile
- umbre puternice
- layout-uri de landing page într-o aplicație enterprise
- efecte decorative fără utilitate
- texte de marketing în dashboard
- badge-uri colorate peste tot
- animații jucăușe
- componente supradimensionate

Vreau o identitate
- medicală
- elegantă
- matură
- curată
- premium
- enterprise
- calmă
- foarte bine organizată

Inspirație conceptuală
software enterprise modern premium, nu startup AI.

Interfața trebuie să dea impresia că poate fi folosită într-o clinică cu
- 40 de medici
- mai multe recepții
- mii de pacienți
- mai multe cabinete
- multe programări zilnice

Folosește
- mult spațiu bine controlat
- tipografie foarte bună
- linii fine
- separatoare discrete
- contrast bun
- tabele curate
- toolbar-uri bine structurate
- panouri laterale elegante
- dropdown-uri profesionale
- modale curate
- densitate informațională bună

Border radius
folosește colțuri subtil rotunjite, nu bubble UI.

Exemplu
4px - 8px pentru majoritatea componentelor.
Maximum aproximativ 10-12px unde are sens.

Nu pune rounded-2xl  rounded-3xl peste tot.

========================================================
2. PALETĂ VIZUALĂ
========================================================

Construiește o temă elegantă pentru o clinică premium.

Direcție recomandată

Background principal
alb cald  ivory foarte subtil  gri foarte deschis.

Suprafețe
alb sau aproape alb.

Text principal
charcoal  aproape negru.

Text secundar
gri sofisticat.

Accent principal
verde închis medical foarte subtil,
sau petrol  teal foarte închis și matur.

Accentul trebuie folosit cu moderație.

Exemplu conceptual
- #F7F7F5 background
- #FFFFFF surfaces
- #191A1A text
- #666B68 secondary
- #173F35  #234E45 accent

Nu copia obligatoriu aceste culori dacă găsești o combinație mai bună,
dar păstrează aceeași filozofie.

Culorile pentru statusuri trebuie să fie discrete

Confirmed
verde subtil

Pending
amber discret

Cancelled
roșu discret

Completed
griverde foarte subtil

No-show
roșu închis  burgundy discret

Nu transforma statusurile în pastile uriașe colorate.

========================================================
3. ANIMAȚII ȘI FEEL
========================================================

Aplicația trebuie să se simtă foarte smooth.

Vreau
- tranziții fine
- hover-uri elegante
- schimbări de pagină fluide
- dropdown-uri animate subtil
- modale bine animate
- calendar drag & drop fluid
- sidebar fluid
- skeleton loading elegant
- feedback imediat după acțiuni
- optimistic UI acolo unde este sigur

Folosește animații scurte și profesionale.

În general
120ms - 250ms.

Nu folosi animații flashy.

Nu anima lucruri fără motiv.

Preferă
opacity
transform
scale foarte subtil
layout transitions

Folosește Framer Motion  Motion doar unde aduce valoare reală.

Respectă prefers-reduced-motion.

Performanța are prioritate față de animații.

========================================================
4. RESPONSIVE
========================================================

Aplicația este desktop-first deoarece va fi folosită predominant la recepție și în cabinete.

Trebuie însă să funcționeze corect și pe
- laptop
- tabletă
- telefon

Pe mobil nu încerca să comprimi calendarul desktop într-un ecran mic.

Creează experiențe adaptate unde este necesar.

========================================================
5. STACK TEHNIC
========================================================

Folosește

- Next.js ultima versiune stabilă
- App Router
- React
- TypeScript strict
- PostgreSQL
- Supabase
- Supabase Auth
- Supabase Storage
- Supabase Row Level Security
- Tailwind CSS
- shadcnui doar ca bază, nu păstra stilul generic shadcn
- Zod
- React Hook Form
- date-fns
- TanStack Query dacă este justificat
- o bibliotecă robustă pentru calendar dacă este necesară

Deployment
Vercel.

Folosește Server Components unde au sens.

Folosește Server Actions sau API routes într-un mod coerent.

Nu expune
- service role key
- secrets
- credentiale private
- operații privilegiate în client

========================================================
6. CALITATEA CODULUI
========================================================

Nu construi business logic direct în componente React.

Separă clar

UI
Domain logic
Scheduling logic
Database access
Authorization
Validation
Storage
Notifications
Audit
API

Codul trebuie să fie
- modular
- typed
- ușor de menținut
- fără duplicate inutile
- fără componente gigantice de 1000+ linii
- fără business logic împrăștiat

Prefer o structură feature-based.

De exemplu

src
  app
  components
  features
    appointments
    calendar
    patients
    doctors
    services
    rooms
    equipment
    results
    documents
    notifications
    patient-portal
    analytics
    settings
  lib
    auth
    db
    scheduling
    permissions
    storage
    validation
    audit
    notifications
  types

supabase
  migrations
  seed

Poți îmbunătăți această structură dacă există o variantă mai bună.

========================================================
7. MULTI-TENANT
========================================================

Voxa OS trebuie construit multi-clinic  multi-tenant de la început.

Structură conceptuală

Organization
    ↓
Clinic  Location
    ↓
Users
Doctors
Patients
Rooms
Equipment
Services
Appointments

O organizație poate avea mai multe locații.

Un utilizator poate avea acces la una sau mai multe clinici.

Separarea datelor NU trebuie realizată doar din frontend.

Folosește
- foreign keys
- organization_id
- clinic_id unde este necesar
- RLS real
- permission checks server-side

Un utilizator al Clinicii A nu trebuie să poată accesa datele Clinicii B modificând un URL sau un request.

========================================================
8. AUTENTIFICARE ȘI ROLURI
========================================================

Implementează autentificare reală.

Roluri inițiale

OWNER
ADMIN
RECEPTION
DOCTOR
ASSISTANT

Permisiunile trebuie să fie centralizate.

Nu scrie peste tot

if role === ...

Construiește un permission system reutilizabil.

OWNER
acces complet.

ADMIN
administrare clinică, medici, utilizatori, programări, pacienți, servicii etc.

RECEPTION
calendar, programări, pacienți, comunicări și informațiile necesare recepției.

DOCTOR
program propriu, pacienți relevanți, rezultate, documente medicale.

ASSISTANT
permisiuni configurabilelimitate.

========================================================
9. BAZĂ DE DATE
========================================================

Construiește schema corect de la început.

Entități orientative

organizations

clinics

profiles

clinic_memberships

roles

permissions

doctors

specialities

doctor_specialities

patients

patient_contacts

patient_addresses

services

service_categories

rooms

equipment

doctor_services

service_required_resources

doctor_availability

room_availability

equipment_availability

schedule_blocks

appointments

appointment_resources

appointment_status_history

appointment_notes

appointment_confirmations

appointment_events

communication_templates

communication_logs

notification_jobs

patient_documents

medical_results

doctor_signatures

doctor_stamps

service_instructions

service_required_documents

service_exclusion_rules

audit_logs

clinic_settings

user_preferences

Poți modificanormaliza schema dacă există o soluție mai bună.

Folosește
- UUID
- foreign keys
- timestamps
- indexuri
- constraints
- unique constraints
- database checks unde au sens

Nu șterge definitiv istoric medical important.

Folosește soft delete unde este necesar.

========================================================
10. CALENDARUL CENTRAL
========================================================

Calendarul Voxa OS este SURSA UNICĂ DE ADEVĂR.

NU există
calendar separat pe site
+
calendar separat în aplicație
+
sync între ele.

Există un singur sistem central.

Același scheduling backend este utilizat de

- recepție
- doctori
- website booking
- patient portal

Dacă recepția creează o programare
slotul dispare imediat de pe site.

Dacă pacientul rezervă de pe site
programarea apare imediat în Voxa OS.

Dacă programarea este mutată
noua disponibilitate trebuie să fie vizibilă peste tot.

========================================================
11. SCHEDULING ENGINE
========================================================

Aceasta este una dintre cele mai importante componente.

Nu construi programarea după regula simplă

doctor free = slot available

O programare poate necesita

- medic
- serviciu
- cabinet
- echipament
- durată
- capacitate
- program de lucru
- pauze
- blocked periods

Exemplu

Ecografie.

Clinica are

Cabinet Ecografie 1
Dr. A

Cabinet Ecografie 2
Dr. B

La ora 1000 pot exista două ecografii simultan.

Dar pentru RMN

există un singur aparat RMN.

Chiar dacă doi medici sunt disponibili,
nu pot exista două programări simultane dacă ambele necesită același aparat.

Construiește un scheduling engine real.

Funcțiidomain logic conceptual

getAvailability()

validateAppointment()

createAppointment()

rescheduleAppointment()

cancelAppointment()

findConflicts()

getRequiredResources()

findAvailableResources()

Serverul trebuie să revalideze disponibilitatea înainte de orice INSERT.

Frontend-ul NU decide dacă un slot este liber.

Protejează sistemul împotriva race conditions.

Dacă doi utilizatori încearcă să rezerve exact același slot în același moment,
nu trebuie să apară double booking.

Folosește tranzacții  locking  constraints  o strategie PostgreSQL corectă.

========================================================
12. CALENDAR UI
========================================================

Construiește un calendar profesional.

Views

ZI
SĂPTĂMÂNĂ
LUNĂ
AGENDA

Pentru recepție, Day și Week sunt cele mai importante.

Calendarul trebuie să suporte

- create
- edit
- drag & drop
- reschedule
- resize dacă este permis
- cancel
- confirm
- mark arrived
- in progress
- complete
- no show

Filtre

- medic
- specialitate
- serviciu
- cabinet
- echipament
- status

Cardul programării trebuie să fie compact.

Să arate

ora
pacient
serviciu
medic
cabinet

Nu transforma fiecare appointment într-un card mare.

Calendarul trebuie să suporte sute de programări fără să devină greu de folosit.

========================================================
13. STATUSURI PROGRAMĂRI
========================================================

Statusuri

PENDING

CONFIRMED

ARRIVED

IN_PROGRESS

COMPLETED

CANCELLED

NO_SHOW

Păstrează istoric de modificări.

Exemplu

1032
Programare creată de Maria Popescu

1035
SMS confirmare trimis

1042
Confirmată de pacient

1355
Pacient sosit

1402
Consultație începută

1429
Consultație finalizată

========================================================
14. PACIENȚI
========================================================

Construiește modul complet Pacienți.

Listă profesională, densă și rapidă.

Search după
- nume
- prenume
- telefon
- email
- identificator intern

Profil pacient.

Secțiuni

Overview
Programări
Istoric
Documente
Rezultate
Note
Comunicări

Evită o interfață cu 20 de carduri enorme.

Preferă tabs, panels și tabele bine construite.

Profil pacient

Date personale
Telefon
Email
Data nașterii
Sex dacă este necesar operațional
Adresă
Identificator intern
Note administrative

Datele sensibile trebuie protejate.

========================================================
15. DETECTARE DUPLICATE
========================================================

La crearea unei programări verifică posibile duplicate.

Exemplu

același pacient
+
aceeași investigație
+
aceeași zi  interval apropiat

sau

același număr de telefon
+
nume similar
+
serviciu similar

Dacă există un posibil duplicat, NU bloca automat în toate cazurile.

Afișează avertizare

Posibilă programare duplicată

Exemplu

Ion Popescu are deja o programare RMN în 14 octombrie, 1030.

Acțiuni

Vezi programarea
Continuă oricum
Renunță

Loghează dacă utilizatorul ignoră avertizarea.

========================================================
16. MEDICI
========================================================

Modul Medici.

Profil medic

- nume
- specialitate
- servicii oferite
- locații
- cabinete uzuale
- program
- disponibilitate
- semnătură
- parafă
- status activinactiv

Doctorul poate avea program diferit pe locații diferite.

Suportă

luni
0800 - 1600

marți
1000 - 1800

etc.

Suportă
- pauze
- concedii
- zile blocate
- program excepțional

========================================================
17. CABINETE ȘI ECHIPAMENTE
========================================================

Modul separat pentru resurse.

Cabinete

- nume
- locație
- tip
- capacitate
- program
- status

Echipamente

- nume
- tip
- locație
- disponibilitate
- mentenanță
- status

Exemplu

RMN Siemens Magnetom
Room MRI 1
capacity 1

Poate fi required resource pentru serviciile RMN.

========================================================
18. SERVICII  INVESTIGAȚII
========================================================

Totul trebuie configurabil.

NU hardcoda
RMN
CT
Ecografie
Mamografie
Cardiologie etc.

Acestea trebuie create din admin.

Pentru fiecare serviciu

Nume

Categorie

Durată implicită

Preț opțional

Medici disponibili

Cabinete eligibile

Echipament necesar

Instrucțiuni

Documente necesare

Reguli  avertismente

Mesaj confirmare

Mesaj reminder

Buffer înainte

Buffer după

Exemplu

RMN cerebral

Durată
30 minute

Documente
Carte de identitate
Bilet de trimitere
Card de sănătate
Creatinină
Rezultate anterioare

Instrucțiuni
text configurabil.

Warnings
pacemaker
implanturi metalice
limită greutate aparat
etc.

Aceste reguli trebuie să fie DATA, nu cod hardcodat.

========================================================
19. PROGRAMARE DE PE SITE
========================================================

Construiește un booking flow public.

Site-ul clinicii trebuie să folosească exact același backend.

Flow

1. Selectează locația
2. Selectează specialitateaserviciul
3. Selectează medicul dacă este relevant
4. Selectează data
5. Vezi sloturile disponibile
6. Completează date pacient
7. Confirmă
8. Programarea intră în Voxa OS

Site-ul nu trebuie să cunoască logica schedulingului.

Conceptual

GET
apipublicavailability

POST
apipublicappointments

Availability API calculează server-side disponibilitatea.

POST appointment trebuie să verifice din nou disponibilitatea.

Nu presupune că slotul este încă liber doar pentru că frontend-ul l-a afișat acum 30 de secunde.

========================================================
20. BOOKING WIDGET
========================================================

Construiește și un booking widget reutilizabil.

Trebuie să poată fi integrat ulterior pe site-ul clinicii.

Poate fi

componentă React

sau

embed configurabil.

Configurabil prin

clinic
location
theme
service preselected
doctor preselected

Nu permite acces la date interne prin acest widget.

========================================================
21. CONFIRMARE PROGRAMARE
========================================================

După creare programare trebuie să existe un sistem de confirmare.

Fiecare programare poate genera un token securizat.

Pacientul primește un link.

Pagina publică

Programarea dumneavoastră

Data
Ora
Clinica
Adresa
Serviciul
Medicul dacă este cazul

Acțiuni

CONFIRMĂ

ANULEAZĂ

VEZI INSTRUCȚIUNILE

Tokenurile

- random
- suficient de lungi
- nu secvențiale
- nu expun appointment ID simplu
- expirabilerevocabile dacă este necesar

Nu expune informații medicale sensibile doar printr-un URL ușor de ghicit.

========================================================
22. SMS ȘI REMINDERE
========================================================

Creează infrastructura de notifications.

Nu lega business logic direct de un singur provider.

Construiește abstraction

NotificationProvider

sendSMS()

sendEmail()

Apoi provider implementation poate fi schimbată.

Pentru moment poate exista integrarea pregătită cu un provider SMS potrivit.

Communication templates configurabile per clinică.

Exemplu

Confirmare programare.

Reminder 24h.

Programare modificată.

Programare anulată.

Rezultat disponibil.

Construiește notification_jobs.

Nu bloca request-ul principal în timp ce trimite SMS.

Folosește procesare asincronăjob strategy adecvată.

========================================================
23. REMINDER
========================================================

Permite configurare

24h înainte
48h înainte
2h înainte

per clinică sau serviciu.

Exemplu

Vă reamintim că în data de 14.02.2027, ora 1030 aveți o programare pentru RMN la Clinica Maria.

Include link securizat

Confirmă
Anulează
Instrucțiuni

========================================================
24. PAGINĂ INSTRUCȚIUNI
========================================================

Din confirmarea programării pacientul trebuie să poată vedea

Acte necesare

Pregătire

Indicații

Locație

Contact

Exemplu

Acte necesare
- Carte de identitate
- Bilet de trimitere
- Card de sănătate
- Analiză creatinină
- Rezultate anterioare

Pregătire
Nu mâncați cu 6 ore înainte etc.

Acestea vin din service configuration.

========================================================
25. PORTAL PACIENT
========================================================

Construiește portal pacient separat de admin dashboard.

Pacientul trebuie să poată vedea

Programări viitoare

Programări anterioare

Rezultate

Documente

Instrucțiuni

Date personale

Trebuie să poată

confirma programare

anula dacă politica clinicii permite

descărca rezultate

Portalul trebuie să fie simplu și elegant.

Nu expune UI-ul intern de recepție pacientului.

========================================================
26. REZULTATE MEDICALE
========================================================

Construiește sistem pentru rezultate.

Un rezultat trebuie legat de

clinic
patient
appointment
doctor
service

Status

draft
validated
released

Doar după validare poate fi disponibil pacientului.

Rezultatele pot avea

text
PDF
document atașat
imaginidocumente suplimentare

Folosește private storage.

NU public bucket.

Folosește signed URLs cu durată limitată pentru descărcări.

========================================================
27. SEMNĂTURĂ ȘI PARAFĂ
========================================================

Doctorul poate avea

semnătură scanată

parafă scanată

Fișierele trebuie stocate privat.

La generarea documentului medical validat,
pot fi incluse în document.

IMPORTANT

Nu trata automat imaginea scanată ca fiind echivalentă juridic cu semnătura electronică calificată.

Construiește arhitectura astfel încât o integrare de semnătură electronică adevărată să poată fi adăugată ulterior.

========================================================
28. DOCUMENTE
========================================================

Patient documents.

Categorii configurabile

- rezultat
- analiză
- trimitere
- consimțământ
- document extern
- rețetă
- alte documente

Documentele trebuie să aibă

created_by
uploaded_by
patient
appointment dacă există
clinic
type
created_at

========================================================
29. FORMULARE  REȚETE
========================================================

Creează infrastructură pentru formulare medicale.

De exemplu un formular intern pentru o rețetă.

Nu hardcoda antibiotice specifice.

Un doctor trebuie să poată

selecta pacient
completa formular
genera document
print
save PDF

Nu pretinde că documentul are automat validitate juridică dacă legislația necesită sisteme externe.

========================================================
30. RECEPȚIE
========================================================

Dashboard recepție.

Accent pe utilitate.

În partea de sus

Data
Locația
Search global
User

Apoi

calendarul zilei

pacienți în așteptare

programări care necesită confirmare

eventual alerte relevante

Nu umple dashboardul cu grafice fără valoare.

========================================================
31. HOME  DASHBOARD
========================================================

Dashboard-ul principal trebuie să fie orientat operațional.

Exemple

Programări astăzi
Confirmate
În așteptare
Pacienți sosiți
No-show
Programări rămase

Apoi

Upcoming appointments

Activity

Nu folosi metric cards gigantice.

Folosește un layout enterprise compact.

========================================================
32. SEARCH GLOBAL
========================================================

Construiește search global rapid.

CtrlCmd + K.

Search

Pacienți

Medici

Programări

Documente

Servicii

Poate avea command palette elegant.

Nu exagera cu command palette animations.

========================================================
33. AUDIT LOG
========================================================

Foarte important.

Loghează acțiuni sensibile

- creare pacient
- modificare pacient
- vizualizare document sensibil dacă este justificat
- creare programare
- schimbare programare
- anulare
- rezultat creat
- rezultat modificat
- rezultat validat
- rezultat descărcat
- schimbare permisiuni
- login relevant
- export date

Audit log

actor
action
entity
entity_id
timestamp
clinic
metadata relevantă

Nu permite utilizatorilor obișnuiți să modifice audit logs.

========================================================
34. SECURITY
========================================================

Securitatea este obligatorie.

Respectă principiile

least privilege

server-side authorization

RLS

secure cookies

CSRF protection unde este relevant

input validation

output encoding

rate limiting

secure file access

secure token generation

no secrets in frontend

no sensitive data in logs

no medical data in analytics tools terțe fără control

Nu folosi localStorage pentru date medicale sensibile.

Nu pune informații medicale complete în URL query params.

Protejează endpointurile publice cu rate limiting.

Protejează login-ul.

Protejează booking-ul public împotriva spamului.

========================================================
35. GDPR  PRIVACY BY DESIGN
========================================================

Aplicația lucrează cu date medicale.

Construiește privacy-by-design.

Implementare tehnică

- minimum necessary access
- tenant isolation
- audit
- private files
- encryption in transit
- retention configurable
- export patient data
- anonymization workflows unde este justificat
- access logs
- consent metadata unde este necesar

Nu afirma în UI că aplicația este GDPR certified.

Construiește infrastructura corectă pentru conformitate.

========================================================
36. RLS
========================================================

Scrie politici Supabase RLS reale.

Nu activa RLS și apoi folosi service role pentru fiecare request, anulând complet beneficiul RLS.

Separă

user-context access

admin privileged operations

background system operations

Testează politici importante.

========================================================
37. VALIDARE
========================================================

Toate formele importante trebuie validate server-side cu Zod.

Client validation este pentru UX.

Server validation este authoritative.

========================================================
38. ERROR HANDLING
========================================================

Nu afișa utilizatorului

Something went wrong

pentru orice eroare.

Construiește mesaje relevante.

Exemplu

Intervalul nu mai este disponibil. O altă programare a fost creată între timp.

Nu aveți permisiunea de a modifica acest rezultat.

Documentul nu a putut fi încărcat.

Loghează erorile tehnice fără a expune informații sensibile în UI.

========================================================
39. TOASTS
========================================================

Folosește notificări toast cu moderație.

Nu pune toast după orice click.

Exemple potrivite

Programare creată.

Programare mutată.

Modificările au fost salvate.

Eroare la salvare.

Nu folosi emoji în toast-uri.

========================================================
40. LOADING
========================================================

Nu afișa spinners peste tot.

Preferă

skeletons

optimistic UI

disabled state

subtle progress

Calendarul trebuie să rămână stabil vizual în timpul loadingului.

========================================================
41. TABLES
========================================================

Tabelele sunt importante într-un software B2B.

Construiește tabele bune.

Funcții

sort

search

filter

pagination

column visibility unde are sens

sticky header unde este util

bulk selection doar unde există acțiuni bulk reale

Nu transforma toate tabelele în card grids.

========================================================
42. USER PREFERENCES
========================================================

Salvează preferințe per user.

Exemple

calendar view implicit

filtre calendar

clinică implicită

ordine module

coloane vizibile

density

Acestea trebuie persistate.

========================================================
43. CUSTOMIZARE DASHBOARD
========================================================

Permite o customizare discretă.

Nu construi un page builder.

Permite

ordonarea unor module

ascunderea modulelor

calendar view implicit

favorite filters

Persistă per utilizator.

========================================================
44. SETTINGS
========================================================

Settings bine organizat.

Categorii

Organizație

Clinici

Utilizatori

Roluri

Medici

Servicii

Cabinete

Echipamente

Program

Notificări

Templates

Portal pacient

Security

Audit

========================================================
45. CLINIC SETUP
========================================================

Construiește onboarding pentru o clinică nouă.

Pas 1
Organizație

Pas 2
Locație clinică

Pas 3
Program

Pas 4
Cabinete

Pas 5
Servicii

Pas 6
Medici

Pas 7
Utilizatori

Nu trebuie să fie childish sau gamified.

========================================================
46. PERFORMANCE
========================================================

Optimizează pentru utilizare reală.

Nu refetch-ui întreaga aplicație după fiecare schimbare.

Folosește

proper caching

query invalidation

pagination

indexes

server-side filtering

lazy loading

code splitting

Calendarul trebuie să funcționeze fluid chiar și cu multe programări.

========================================================
47. ACCESSIBILITY
========================================================

Respectă accessibility de bază

keyboard navigation

focus states

semantic HTML

labels

contrast

ARIA unde este justificat

Nu elimina outline fără alternativă.

========================================================
48. EMPTY STATES
========================================================

Empty state-urile trebuie să fie mature.

Exemplu

Nu există programări pentru această zi.

button
Programare nouă

NU

emojicalendar gigantic
Yay! Nothing here!

========================================================
49. COPY  LIMBA
========================================================

Interfața inițială trebuie să fie în LIMBA ROMÂNĂ.

Textele trebuie să sune natural și profesional.

Exemple

Programare nouă

Pacienți

Medici

Cabinete

Servicii

Confirmată

În așteptare

Anulată

Finalizată

Pacient absent

Nu folosi traduceri literale proaste din engleză.

Pregătește arhitectura pentru i18n în viitor.

========================================================
50. DESIGN SYSTEM
========================================================

Construiește un design system intern.

Definește

colors

spacing

typography

radius

shadows

motion

status colors

form components

buttons

tables

dialogs

drawers

tooltips

navigation

Nu stiliza fiecare pagină independent.

========================================================
51. NAVIGAȚIE
========================================================

Sidebar desktop profesional.

Exemplu

VOXA

Principal
Calendar
Pacienți
Medici

Management
Servicii
Cabinete
Echipamente

Medical
Rezultate
Documente

Administrare
Utilizatori
Rapoarte
Setări

Nu pune icon pentru absolut orice dacă nu este necesar.

Folosește iconuri line consistente și discrete.

Sidebar collapse.

========================================================
52. APPOINTMENT DRAWER
========================================================

La click pe o programare nu naviga obligatoriu spre o pagină complet nouă.

Construiește un drawer  side panel foarte bun.

Arată rapid

pacient

telefon

serviciu

doctor

cabinet

data

ora

status

note

istoric

Acțiuni

Confirmă

Marchează sosit

Modifică

Anulează

Deschide pacient

Pentru modificări complexe poate exista pagina completă.

========================================================
53. CREATE APPOINTMENT EXPERIENCE
========================================================

Crearea unei programări trebuie să fie foarte rapidă.

Recepționista nu trebuie să treacă prin 8 pagini.

Flow compact

Pacient

Serviciu

Medic

Dată

Oră

Cabinet  resource automat dacă este posibil

Note

Sistemul sugerează resurse valide.

Search pacient în timp real.

Dacă pacientul nu există
Pacient nou

fără să părăsească procesul de programare.

========================================================
54. AUTOMATIC RESOURCE ASSIGNMENT
========================================================

Dacă un serviciu poate avea mai multe cabineteresurse valide,
sistemul poate aloca automat o resursă disponibilă.

Receptionistul poate schimba manual dacă are permisiune.

========================================================
55. SCHEDULE BLOCKS
========================================================

Suportă blocări

concediu

pauză

mentenanță aparat

cabinet indisponibil

ședință

blocare manuală

Blocurile trebuie să afecteze availability engine.

========================================================
56. RAPOARTE
========================================================

Construiește doar rapoarte utile inițial.

Exemple

Programări per perioadă

Anulări

No-show

Grad ocupare

Programări per medic

Programări per serviciu

Nu umple aplicația cu charts decorative.

Preferă date clare și export CSV unde este justificat.

========================================================
57. EMAIL
========================================================

Arhitectura trebuie să permită și email.

Templates separate

appointment confirmation

appointment reminder

appointment changed

result available

Folosește email HTML simplu și premium.

Nu marketing email style.

========================================================
58. TESTARE
========================================================

Scrie teste pentru logica critică.

În special

scheduling engine

conflict detection

multi-resource scheduling

tenant isolation

permission checks

confirmation tokens

appointment creation

rescheduling

race condition protection

Nu este necesar să testezi fiecare div.

Testează business logic.

========================================================
59. SEED
========================================================

Creează seed data realistă pentru development.

O clinică fictivă

Clinica Maria

Locație
Oradea

Exemple

Dr. Andrei Popescu
Radiologie

Dr. Ioana Marinescu
Ecografie

Servicii

RMN cerebral
CT torace
Ecografie abdominală
Mamografie
Consultație cardiologie

Cabinete

RMN 1
CT 1
Ecografie 1
Ecografie 2

Echipamente

Aparat RMN
Aparat CT

Pacienți ficționali.

Folosește clar date fictive.

========================================================
60. DEVELOPMENT VS PRODUCTION
========================================================

Seed data doar în development.

Nu include automat demo data în production.

========================================================
61. ENVIRONMENT VARIABLES
========================================================

Creează

.env.example

Documentează variabilele necesare.

Nu commit-ui secrets.

========================================================
62. README
========================================================

Creează README profesionist.

Include

setup

Supabase setup

migrations

seed

environment variables

development

tests

deployment

architecture summary

========================================================
63. MIGRATIONS
========================================================

Toată schema trebuie să existe în migrations.

Nu cere configurare manuală din dashboard-ul Supabase dacă poate fi făcută prin migration.

========================================================
64. IMPLEMENTATION STRATEGY
========================================================

Înainte să scrii cod

1. proiectează arhitectura
2. proiectează database schema
3. proiectează scheduling engine
4. proiectează permission model
5. proiectează design system
6. apoi implementează

Nu te opri după plan.

Continuă cu implementarea.

Construiește în ordine logică

PHASE 1
foundation
auth
database
multi-tenancy
permissions
design system

PHASE 2
patients
doctors
services
rooms
equipment

PHASE 3
scheduling engine

PHASE 4
calendar

PHASE 5
website booking

PHASE 6
confirmationreminders

PHASE 7
documentsresults

PHASE 8
patient portal

PHASE 9
settingsauditreports

PHASE 10
testingsecurityperformancepolish

========================================================
65. DEFINITION OF DONE
========================================================

Nu considera task-ul finalizat doar pentru că UI-ul arată bine.

Aplicația este gata doar dacă flow-uri reale funcționează

FLOW A

Admin creează clinică
→ creează cabinet
→ creează echipament
→ creează serviciu
→ adaugă medic
→ configurează program
→ recepția poate crea programare.

FLOW B

Recepția creează programare
→ apare în calendar
→ slotul nu mai este disponibil online.

FLOW C

Pacient rezervă online
→ scheduling engine validează
→ programarea este salvată
→ apare imediat în calendarul Voxa OS.

FLOW D

Recepția mută programarea
→ conflict detection rulează
→ programarea este mutată
→ disponibilitatea veche devine liberă
→ noul slot devine ocupat.

FLOW E

Două persoane încearcă același slot
→ doar una poate crea programarea.

FLOW F

Pacient confirmă prin link securizat
→ statusul devine CONFIRMED
→ apare în calendar.

FLOW G

Doctor validează rezultat
→ rezultatul devine disponibil pacientului
→ fișierul rămâne privat
→ pacientul îl descarcă prin acces autorizat.

FLOW H

User din altă clinică încearcă acces direct prin URLAPI
→ acces refuzat.

========================================================
66. UX POLISH
========================================================

După ce funcționalitatea este implementată

fă un pass separat de UX polish.

Verifică

spacing

alignment

typography

consistent heights

calendar density

responsive behavior

hover

focus

loading

empty states

error states

dialogs

drawers

tables

forms

animations

Fă interfața să pară făcută de o echipă de product design enterprise, nu generată într-un singur prompt.

========================================================
67. CODE QUALITY PASS
========================================================

După implementare

rulează

TypeScript

lint

tests

build

Identifică și repară

type errors

runtime errors

broken imports

hydration issues

RLS issues

permission bugs

race conditions

broken responsive layouts

dead buttons

placeholder functionality

========================================================
68. IMPORTANT FINAL RULES
========================================================

Nu simplifica scheduling engine-ul doar pentru a termina mai repede.

Nu înlocui funcționalitate reală cu mock-uri.

Nu lăsa TODO-uri pentru funcțiile centrale.

Nu crea butoane inactive.

Nu crea pagini fake.

Nu hardcoda o singură clinică.

Nu construi aplicația exclusiv pentru Clinica Maria.

Clinica Maria este doar seed development data.

Nu folosi AI receptionist momentan.

Nu adăuga chatbot.

Nu adăuga AI features doar pentru că produsul se numește Voxa.

Prioritatea este

1. corectitudine
2. securitate
3. scheduling
4. UX
5. performanță
6. design
7. extensibilitate

Rezultatul final trebuie să fie o fundație reală de produs SaaS B2B medical, suficient de serioasă încât să poată fi prezentată unei clinici private mari fără să arate ca un MVP făcut într-un weekend.

Începe prin a inspecta repo-ul gol și a configura proiectul corect.

Apoi construiește efectiv aplicația.
Nu te opri la explicații.
Nu mă întreba să confirm fiecare etapă.
Ia decizii tehnice rezonabile și continuă implementarea până când flow-urile principale sunt funcționale.