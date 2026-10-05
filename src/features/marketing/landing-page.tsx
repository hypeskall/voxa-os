import { T, LocalizedElement } from "@/components/locale-provider";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CalendarDays,
  ContactRound,
  Stethoscope,
  MessageSquare,
  ShieldCheck,
  Building2,
  KeyRound,
  History,
  ChevronDown,
  Play,
} from "lucide-react";
import { MarketingHeader } from "./marketing-header";
import { MarketingFooter } from "./marketing-footer";
import { MarketingMotion } from "./marketing-motion";
import { WorkspaceShowcase } from "./workspace-showcase";
import { ProductShowcase } from "./product-showcase";
import { PlanPicker } from "@/features/subscriptions/plan-picker";
import { MONTHLY_PRICE } from "@/features/subscriptions/model";
import { productMedia, type ProductMediaKey } from "./product-media";

const faqs = [
  [
    "Ce include perioada de testare?",
    "Ai 30 de zile de acces la funcționalitățile platformei, pentru organizația și locațiile tale. Fără costuri în perioada de testare și fără o plată inițială.",
  ],
  [
    "Pot adăuga mai mulți medici și locații?",
    "Da. Configurezi medicii, serviciile și disponibilitatea pentru fiecare locație. Colegii primesc acces prin roluri, iar abonamentul se aplică organizației.",
  ],
  [
    "Ce se întâmplă după cele 30 de zile?",
    "Dacă nu ai un abonament activ, accesul operațional este suspendat. Datele clinicii sunt păstrate. Proprietarul poate activa abonamentul prin plata online sau printr-o licență, din pagina Abonament.",
  ],
  [
    "Cum activez abonamentul?",
    "Abonamentul este de 19,99 EUR pe lună sau 149,99 EUR pe an (economisești 37,5%). Proprietarul îl activează din pagina Abonament, prin plata online securizată cu Stripe sau cu o licență primită de la echipa Voxa-OS. Perioada de testare nu se transformă automat într-un abonament cu plată. Abonamentul plătit online se reînnoiește în funcție de perioada aleasă și poate fi anulat din cont.",
  ],
  [
    "Este nevoie de instalare?",
    "Nu. Voxa-OS funcționează în browser. Creezi contul, configurezi clinica și poți începe să lucrezi.",
  ],
  [
    "Cine poate vedea datele clinicii?",
    "Accesul necesită autentificare și apartenență la clinică. Permisiunile sunt stabilite prin rol: proprietar, administrator, recepție sau medic.",
  ],
];
const supportingFeatures = [
  {
    icon: ContactRound,
    title: "Pacienți, cu tot contextul",
    body: "Date administrative, documente, rezultate și istoricul programărilor.",
  },
  {
    icon: Stethoscope,
    title: "Medici și servicii",
    body: "Disponibilitate, durate și resurse, configurate pentru fiecare locație.",
  },
  {
    icon: MessageSquare,
    title: "Comunicare la îndemână",
    body: "Acces la mesajele WhatsApp și evidența comunicărilor cu pacientul.",
  },
  {
    icon: Building2,
    title: "Locații coordonate",
    body: "Cabinetele, echipa și setările, organizate sub aceeași organizație.",
  },
];
const productStories = [
  {
    number: "01",
    label: "SPAȚIU DE LUCRU",
    title: "Începi ziua cu o imagine clară.",
    body: "Programările zilei, statusurile și situațiile care cer atenție. Vezi ce se întâmplă înainte să începi următoarea activitate.",
    detail: "Indicatori zilnici · Activitate recentă",
    src: "dashboard",
    alt: "Dashboard Voxa-OS cu indicatori și programările zilei",
  },
  {
    number: "02",
    label: "CALENDAR ȘI PROGRAMĂRI",
    title: "Un program comun. Mai puține suprapuneri.",
    body: "Coordonezi medicii, intervalele și resursele în același calendar. Deschizi o programare pentru detalii, confirmare sau reprogramare.",
    detail: "Vedere săptămânală · Disponibilitate · Resurse",
    src: "calendar",
    alt: "Calendar Voxa-OS cu programări demonstrative pe zile și ore",
  },
  {
    number: "03",
    label: "PACIENȚI",
    title: "Fiecare pacient, în context.",
    body: "De la datele de contact la programări, documente și rezultate. Un profil organizat, ușor de consultat de colegii autorizați.",
    detail: "Profil · Documente · Istoric",
    src: "patient-profile",
    alt: "Profilul unui pacient demonstrativ în Voxa-OS",
  },
];

export function LandingPage({
  authenticated,
  videoSrc,
  supportEmail,
}: {
  authenticated: boolean;
  videoSrc?: string;
  supportEmail?: string;
}) {
  const destination = authenticated ? "/dashboard" : "/register";
  const cta = authenticated ? "Deschide platforma" : "Începe testarea gratuită";
  return (
    <div className="marketing-page">
      <a className="skip-link" href="#marketing-main"><T>{"Sari la conținut"}</T></a>
      <MarketingHeader authenticated={authenticated} />
      <MarketingMotion>
        <main id="marketing-main">
          <section
            className="marketing-container marketing-hero"
            aria-labelledby="hero-title"
          >
            <div className="hero-copy">
              <span className="marketing-eyebrow hero-enter"><T>{"SOFTWARE PENTRU CLINICI"}</T></span>
              <h1 id="hero-title" className="hero-enter"><T>{"Mai mult control."}</T><br />
                <span><T>{"Mai puțin haos."}</T></span>
              </h1>
              <p className="hero-description hero-enter"><T>{"Programări, pacienți și echipă, într-un singur spațiu de lucru. Pentru o clinică în care fiecare zi are un plan."}</T></p>
              <div className="marketing-actions hero-enter">
                <Link
                  href={destination}
                  className="marketing-button is-primary"
                >
                  <T>{cta}</T>
                  <ArrowRight size={17} />
                </Link>
                <a href="#prezentare" className="marketing-button is-secondary">
                  <Play size={15} /><T>{"Vezi platforma"}</T></a>
              </div>
              <p className="hero-trial hero-enter">
                <Check size={14} />
                <span><T>{"30 de zile gratuit "}</T><span className="marketing-dot">·</span><T>{" "}</T><T>{"Apoi "}</T>{MONTHLY_PRICE}<T>{" / lună sau 149,99 EUR / an"}</T></span>
              </p>
              <div className="hero-audience hero-enter">
                <span><T>{"GÂNDIT PENTRU"}</T></span>
                <p><T>{"Clinici medicale "}</T><span> / </span><T>{" Cabinete "}</T><span> / </span><T>{" "}</T><T>{"Centre de investigații"}</T></p>
              </div>
            </div>
            <figure className="hero-product hero-enter">
              <div className="hero-product-rail">
                <span>
                  <i /><T>{"Spațiul tău de lucru"}</T></span>
                <span><T>{"Voxa-OS"}</T></span>
              </div>
              <div className="hero-screen-frame marketing-screen">
                <Image
                  src={productMedia.calendar}
                  alt="Calendarul real Voxa-OS cu programări pentru o clinică demonstrativă"
                  width={1440}
                  height={1000}
                  sizes="(max-width: 760px) 95vw, (max-width: 1100px) 85vw, 800px"
                  preload
                />
              </div>
              <div className="hero-appointment">
                <Image
                  src={productMedia["appointment-detail"]}
                  alt="Detaliile unei programări demonstrative: pacient, medic și interval"
                  width={560}
                  height={1000}
                  sizes="(max-width: 760px) 150px, 260px"
                />
                <span><T>{"Detaliile, la un click distanță."}</T><ArrowUpRight size={14} />
                </span>
              </div>
              <figcaption><T>{"Interfața reală a platformei. Date demonstrative."}</T></figcaption>
            </figure>
          </section>
          <div className="marketing-proof-strip">
            <div className="marketing-container">
              <span className="proof-intro"><T>{"Întreaga clinică."}</T><br />
                <strong><T>{"Același ritm de lucru."}</T></strong>
              </span>
              <span>
                <CalendarDays size={20} /><T>{"Programări coordonate"}</T></span>
              <span>
                <ContactRound size={20} /><T>{"Evidență centralizată"}</T></span>
              <span>
                <ShieldCheck size={20} /><T>{"Acces pe roluri"}</T></span>
            </div>
          </div>

          <section
            id="functionalitati"
            className="marketing-container marketing-section marketing-capabilities"
            aria-labelledby="capabilities-title"
          >
            <div className="marketing-section-heading" data-reveal>
              <div>
                <span className="marketing-eyebrow"><T>{"MAI PUȚINĂ FRAGMENTARE"}</T></span>
                <h2 id="capabilities-title"><T>{"Tot ce ține clinica"}</T><br /><T>{"în mișcare."}</T></h2>
              </div>
              <p><T>{"Instrumentele de zi cu zi, conectate în același loc. De la prima programare la organizarea întregii echipe."}</T></p>
            </div>
            <div className="capability-layout" data-reveal>
              <article className="capability-main">
                <span className="capability-index"><T>{"FUNCȚIA CENTRALĂ / 01"}</T></span>
                <CalendarDays size={28} strokeWidth={1.3} />
                <h3><T>{"Un calendar."}</T><br /><T>{"Toată echipa."}</T></h3>
                <p><T>{"Programări, disponibilitate și resurse coordonate. Claritate pentru recepție, context pentru medic."}</T></p>
                <a href="#calendar" className="marketing-text-link"><T>{"Descoperă calendarul"}</T><ArrowUpRight size={17} />
                </a>
                <div className="capability-calendar">
                  <Image
                    src={productMedia.calendar}
                    alt="Detaliu din calendarul săptămânal Voxa-OS"
                    width={1440}
                    height={1000}
                    sizes="(max-width: 760px) 700px, 850px"
                  />
                </div>
              </article>
              <div className="capability-support">
                {supportingFeatures.map(
                  ({ icon: Icon, title, body }, index) => (
                    <article key={title}>
                      <div className="capability-support-top">
                        <Icon size={22} strokeWidth={1.4} />
                        <span>0{index + 2}</span>
                      </div>
                      <h3><T>{title}</T></h3>
                      <p><T>{body}</T></p>
                    </article>
                  ),
                )}
              </div>
            </div>
          </section>

          <section
            id="platforma"
            className="marketing-product-stories"
            aria-labelledby="stories-title"
          >
            <div className="marketing-container">
              <div className="marketing-section-heading" data-reveal>
                <div>
                  <span className="marketing-eyebrow"><T>{"PRODUSUL, ÎN DETALIU"}</T></span>
                  <h2 id="stories-title"><T>{"O singură platformă."}</T><br /><T>{"Un flux firesc."}</T></h2>
                </div>
                <p><T>{"O interfață familiară, construită în jurul modului în care lucrează o clinică."}</T></p>
              </div>
              {productStories.map((story, index) => (
                <article
                  key={story.src}
                  id={story.src === "calendar" ? "calendar" : undefined}
                  className={`product-story ${index % 2 ? "is-reversed" : ""}`}
                  data-reveal
                >
                  <div className="product-story-copy">
                    <span className="marketing-eyebrow">
                      {story.number} / <T>{story.label}</T>
                    </span>
                    <h3><T>{story.title}</T></h3>
                    <p><T>{story.body}</T></p>
                    <span className="product-story-detail"><T>{story.detail}</T></span>
                  </div>
                  <figure className="product-story-visual">
                    <LocalizedElement as="div"
                      className="marketing-screen"
                      tabIndex={0}
                      role="region"
                      aria-label={`${story.label} — previzualizare produs`}
                    >
                      <Image
                        src={productMedia[story.src as ProductMediaKey]}
                        alt={`${story.alt}, cu date demonstrative`}
                        width={1440}
                        height={1000}
                        sizes="(max-width: 760px) 720px, (max-width: 1100px) 90vw, 850px"
                      />
                    </LocalizedElement>
                    <figcaption><T>{"VOXA-OS "}</T><span>/ {story.number}</span>
                    </figcaption>
                  </figure>
                </article>
              ))}
              <WorkspaceShowcase />
            </div>
          </section>

          <section
            id="cum-functioneaza"
            className="marketing-container marketing-section marketing-workflow"
            aria-labelledby="workflow-title"
          >
            <div data-reveal>
              <span className="marketing-eyebrow"><T>{"DE LA CONT LA PRIMA PROGRAMARE"}</T></span>
              <h2 id="workflow-title"><T>{"Un început simplu."}</T><br /><T>{"Un mod de lucru comun."}</T></h2>
            </div>
            <ol data-reveal>
              {[
                [
                  "Creezi spațiul clinicii",
                  "Înregistrezi organizația și adaugi locațiile în care lucrează echipa.",
                ],
                [
                  "Configurezi modul de lucru",
                  "Adaugi medici, servicii, disponibilitate și resurse. Inviți colegii cu rolurile potrivite.",
                ],
                [
                  "Începi prima programare",
                  "Adaugi pacientul și alegi un interval disponibil. Restul echipei are același context.",
                ],
              ].map(([title, body], index) => (
                <li key={title}>
                  <span>0{index + 1}</span>
                  <div>
                    <h3><T>{title}</T></h3>
                    <p><T>{body}</T></p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section
            id="prezentare"
            className="marketing-demo-section"
            aria-labelledby="demo-title"
          >
            <div className="marketing-container">
              <div className="marketing-section-heading" data-reveal>
                <div>
                  <span className="marketing-eyebrow"><T>{"VEZI CUM SE LEAGĂ TOTUL"}</T></span>
                  <h2 id="demo-title"><T>{"Dintr-o privire,"}</T><br /><T>{"în ritmul clinicii."}</T></h2>
                </div>
                <p>
                  <T>{videoSrc
                    ? "Urmărește prezentarea platformei, în ritmul tău."
                    : "24 de secunde prin interfața Voxa-OS. De la calendar la pacient și înapoi la activitatea zilei."}</T>
                </p>
              </div>
              <div data-reveal>
                <ProductShowcase videoSrc={videoSrc} />
              </div>
            </div>
          </section>

          <section
            className="marketing-container marketing-trust"
            aria-labelledby="trust-title"
            data-reveal
          >
            <div>
              <span className="marketing-eyebrow"><T>{"CONTROL, LA FIECARE NIVEL"}</T></span>
              <h2 id="trust-title"><T>{"Accesul potrivit."}</T><br /><T>{"În contextul potrivit."}</T></h2>
              <p><T>{"Controale concrete pentru informațiile și activitatea clinicii."}</T></p>
            </div>
            <div className="trust-controls">
              {[
                {
                  icon: KeyRound,
                  title: "Permisiuni pe roluri",
                  body: "Acces distinct pentru proprietar, administrator, recepție și medic.",
                },
                {
                  icon: Building2,
                  title: "Date în contextul clinicii",
                  body: "Acces verificat pentru organizație și locațiile autorizate.",
                },
                {
                  icon: History,
                  title: "Istoric operațional",
                  body: "Modificările programărilor și acțiunile relevante sunt înregistrate.",
                },
              ].map(({ icon: Icon, title, body }) => (
                <article key={title}>
                  <Icon size={22} strokeWidth={1.4} />
                  <div>
                    <h3><T>{title}</T></h3>
                    <p><T>{body}</T></p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section
            id="pret"
            className="marketing-pricing-section"
            aria-labelledby="pricing-title"
          >
            <div className="marketing-container">
              <div className="marketing-section-heading" data-reveal>
                <div>
                  <span className="marketing-eyebrow"><T>{"PREȚ CLAR, DE LA ÎNCEPUT"}</T></span>
                  <h2 id="pricing-title"><T>{"Un plan."}</T><br /><T>{"Toată clinica."}</T></h2>
                </div>
                <p><T>{"30 de zile pentru a vedea dacă Voxa-OS se potrivește clinicii tale. Fără costuri în perioada de testare."}</T></p>
              </div>
              <div className="marketing-pricing-panel" data-reveal>
                <div className="pricing-inclusions">
                  <span className="marketing-eyebrow"><T>{"ABONAMENT PENTRU ORGANIZAȚIE"}</T></span>
                  <h3><T>{"Voxa-OS"}</T></h3>
                  <p><T>{"Spațiul de lucru al clinicii, cu funcționalitățile conectate."}</T></p>
                  <ul>
                    {[
                      "Calendar și programări",
                      "Pacienți, documente și rezultate",
                      "Medici, servicii și resurse",
                      "Locații, echipă și acces pe roluri",
                    ].map((item) => (
                      <li key={item}>
                        <Check size={16} />
                        <T>{item}</T>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="pricing-decision">
                  <span className="pricing-trial"><T>{"Primele 30 de zile, gratuit."}</T></span>
                  <PlanPicker />
                  <Link
                    href={destination}
                    className="marketing-button is-primary"
                  >
                    <T>{cta}</T>
                    <ArrowRight size={17} />
                  </Link>
                  <p><T>{"Fără plată inițială."}</T><br /><T>{"Fără trecere automată la un abonament cu plată."}</T></p>
                  <span className="pricing-activation"><T>{"Activare prin plata online sau licență, din contul organizației."}</T></span>
                </div>
              </div>
            </div>
          </section>

          <section
            id="intrebari"
            className="marketing-container marketing-section marketing-faq"
            aria-labelledby="faq-title"
          >
            <div data-reveal>
              <span className="marketing-eyebrow"><T>{"ÎNAINTE SĂ ÎNCEPI"}</T></span>
              <h2 id="faq-title"><T>{"Câteva răspunsuri."}</T><br /><T>{"Mai multă claritate."}</T></h2>
              <p><T>{"Detaliile care contează când alegi un nou mod de lucru."}</T></p>
            </div>
            <div className="marketing-faq-list" data-reveal>
              {faqs.map(([question, answer]) => (
                <details key={question}>
                  <summary>
                    <T>{question}</T>
                    <ChevronDown size={18} />
                  </summary>
                  <div className="faq-answer">
                    <p><T>{answer}</T></p>
                  </div>
                </details>
              ))}
            </div>
          </section>

          <section
            className="marketing-final-section"
            aria-labelledby="final-title"
          >
            <div
              className="marketing-container marketing-final-cta"
              data-reveal
            >
              <div>
                <span className="marketing-eyebrow"><T>{"URMĂTOAREA ZI POATE ÎNCEPE ALTFEL."}</T></span>
                <h2 id="final-title"><T>{"Mai multă ordine."}</T><br /><T>{"Mai mult loc pentru pacienți."}</T></h2>
                <p><T>{"Începe cu 30 de zile în care întreaga echipă poate descoperi Voxa-OS."}</T></p>
                <div className="marketing-actions">
                  <Link
                    href={destination}
                    className="marketing-button is-light"
                  >
                    <T>{cta}</T>
                    <ArrowRight size={17} />
                  </Link>
                  <Link
                    href={authenticated ? "/dashboard" : "/login"}
                    className="marketing-final-login"
                  >
                    <T>{authenticated
                      ? "Platforma mea"
                      : "Ai deja cont? Autentificare"}</T>
                    <ArrowUpRight size={16} />
                  </Link>
                </div>
              </div>
              <div className="final-product-signature" aria-hidden="true">
                <span className="signature-mark"><T>{"V"}</T></span>
                <span><T>{"VOXA"}</T><span><T>{"-OS"}</T></span>
                </span>
                <small><T>{"UN SPAȚIU DE LUCRU COMUN."}</T></small>
              </div>
            </div>
          </section>
        </main>
      </MarketingMotion>
      <MarketingFooter
        authenticated={authenticated}
        supportEmail={supportEmail}
      />
    </div>
  );
}
