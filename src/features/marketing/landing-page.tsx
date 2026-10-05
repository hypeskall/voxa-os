import { T, LocalizedElement } from "@/components/locale-provider";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  ContactRound,
  Stethoscope,
  MessageSquare,
  Building2,
  KeyRound,
  History,
  ChevronDown,
} from "lucide-react";
import { marketingPages, type MarketingPage } from "./navigation";
import { MarketingHeader } from "./marketing-header";
import { MarketingFooter } from "./marketing-footer";
import { MarketingMotion } from "./marketing-motion";
import { WorkspaceShowcase } from "./workspace-showcase";
import { ProductShowcase } from "./product-showcase";
import { productMedia, type ProductMediaKey } from "./product-media";
import { MarketingHome } from "./marketing-home";
import { MarketingPrice } from "./marketing-price";
import { marketingFaqs } from "./marketing-content";

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
  page = "home",
}: {
  authenticated: boolean;
  videoSrc?: string;
  supportEmail?: string;
  page?: MarketingPage;
}) {
  if (page === "home")
    return (
      <MarketingHome
        authenticated={authenticated}
        videoSrc={videoSrc}
        supportEmail={supportEmail}
      />
    );
  return (
    <div className="marketing-page marketing-subpage">
      <a className="skip-link" href="#marketing-main">
        <T>{"Sari la conținut"}</T>
      </a>
      <MarketingHeader authenticated={authenticated} />
      <MarketingMotion key={page}>
        <main id="marketing-main">
          <div className="marketing-container marketing-page-intro">
            <Link href="/" className="marketing-text-link">
              <T>{"Pagina principală"}</T>
              <ArrowUpRight size={16} />
            </Link>
            <h1>
              <T>{marketingPages.find((item) => item.page === page)!.label}</T>
            </h1>
          </div>
          {page === "functionalitati" && (
            <section
              id="functionalitati"
              className="marketing-container marketing-section marketing-capabilities"
              aria-labelledby="capabilities-title"
            >
              <div className="marketing-section-heading" data-reveal>
                <div>
                  <span className="marketing-eyebrow">
                    <T>{"MAI PUȚINĂ FRAGMENTARE"}</T>
                  </span>
                  <h2 id="capabilities-title">
                    <T>{"Tot ce ține clinica"}</T>
                    <br />
                    <T>{"în mișcare."}</T>
                  </h2>
                </div>
                <p>
                  <T>
                    {
                      "Instrumentele de zi cu zi, conectate în același loc. De la prima programare la organizarea întregii echipe."
                    }
                  </T>
                </p>
              </div>
              <div className="capability-layout" data-reveal>
                <article className="capability-main">
                  <span className="capability-index">
                    <T>{"FUNCȚIA CENTRALĂ / 01"}</T>
                  </span>
                  <CalendarDays size={28} strokeWidth={1.3} />
                  <h3>
                    <T>{"Un calendar."}</T>
                    <br />
                    <T>{"Toată echipa."}</T>
                  </h3>
                  <p>
                    <T>
                      {
                        "Programări, disponibilitate și resurse coordonate. Claritate pentru recepție, context pentru medic."
                      }
                    </T>
                  </p>
                  <Link href="/produs" className="marketing-text-link">
                    <T>{"Descoperă calendarul"}</T>
                    <ArrowUpRight size={17} />
                  </Link>
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
                        <h3>
                          <T>{title}</T>
                        </h3>
                        <p>
                          <T>{body}</T>
                        </p>
                      </article>
                    ),
                  )}
                </div>
              </div>
            </section>
          )}

          {page === "produs" && (
            <section
              id="platforma"
              className="marketing-product-stories"
              aria-labelledby="stories-title"
            >
              <div className="marketing-container">
                <div className="marketing-section-heading" data-reveal>
                  <div>
                    <span className="marketing-eyebrow">
                      <T>{"PRODUSUL, ÎN DETALIU"}</T>
                    </span>
                    <h2 id="stories-title">
                      <T>{"O singură platformă."}</T>
                      <br />
                      <T>{"Un flux firesc."}</T>
                    </h2>
                  </div>
                  <p>
                    <T>
                      {
                        "O interfață familiară, construită în jurul modului în care lucrează o clinică."
                      }
                    </T>
                  </p>
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
                      <h3>
                        <T>{story.title}</T>
                      </h3>
                      <p>
                        <T>{story.body}</T>
                      </p>
                      <span className="product-story-detail">
                        <T>{story.detail}</T>
                      </span>
                    </div>
                    <figure className="product-story-visual">
                      <LocalizedElement
                        as="div"
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
                      <figcaption>
                        <T>{"VOXA-OS "}</T>
                        <span>/ {story.number}</span>
                      </figcaption>
                    </figure>
                  </article>
                ))}
                <WorkspaceShowcase />
              </div>
            </section>
          )}

          {page === "cum-functioneaza" && (
            <section
              id="cum-functioneaza"
              className="marketing-container marketing-section marketing-workflow"
              aria-labelledby="workflow-title"
            >
              <div data-reveal>
                <span className="marketing-eyebrow">
                  <T>{"DE LA CONT LA PRIMA PROGRAMARE"}</T>
                </span>
                <h2 id="workflow-title">
                  <T>{"Un început simplu."}</T>
                  <br />
                  <T>{"Un mod de lucru comun."}</T>
                </h2>
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
                      <h3>
                        <T>{title}</T>
                      </h3>
                      <p>
                        <T>{body}</T>
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {page === "prezentare" && (
            <section
              id="prezentare"
              className="marketing-demo-section"
              aria-labelledby="demo-title"
            >
              <div className="marketing-container">
                <div className="marketing-section-heading" data-reveal>
                  <div>
                    <span className="marketing-eyebrow">
                      <T>{"VEZI CUM SE LEAGĂ TOTUL"}</T>
                    </span>
                    <h2 id="demo-title">
                      <T>{"Dintr-o privire,"}</T>
                      <br />
                      <T>{"în ritmul clinicii."}</T>
                    </h2>
                  </div>
                  <p>
                    <T>
                      {videoSrc
                        ? "Urmărește prezentarea platformei, în ritmul tău."
                        : "24 de secunde prin interfața Voxa-OS. De la calendar la pacient și înapoi la activitatea zilei."}
                    </T>
                  </p>
                </div>
                <div data-reveal>
                  <ProductShowcase videoSrc={videoSrc} />
                </div>
              </div>
            </section>
          )}

          {page === "produs" && (
            <section
              className="marketing-container marketing-trust"
              aria-labelledby="trust-title"
              data-reveal
            >
              <div>
                <span className="marketing-eyebrow">
                  <T>{"CONTROL, LA FIECARE NIVEL"}</T>
                </span>
                <h2 id="trust-title">
                  <T>{"Accesul potrivit."}</T>
                  <br />
                  <T>{"În contextul potrivit."}</T>
                </h2>
                <p>
                  <T>
                    {
                      "Controale concrete pentru informațiile și activitatea clinicii."
                    }
                  </T>
                </p>
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
                      <h3>
                        <T>{title}</T>
                      </h3>
                      <p>
                        <T>{body}</T>
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {page === "pret" && <MarketingPrice authenticated={authenticated} />}

          {page === "faq" && (
            <section
              id="intrebari"
              className="marketing-container marketing-section marketing-faq"
              aria-labelledby="faq-title"
            >
              <div data-reveal>
                <span className="marketing-eyebrow">
                  <T>{"ÎNAINTE SĂ ÎNCEPI"}</T>
                </span>
                <h2 id="faq-title">
                  <T>{"Câteva răspunsuri."}</T>
                  <br />
                  <T>{"Mai multă claritate."}</T>
                </h2>
                <p>
                  <T>
                    {"Detaliile care contează când alegi un nou mod de lucru."}
                  </T>
                </p>
              </div>
              <div className="marketing-faq-list" data-reveal>
                {marketingFaqs.map(([question, answer]) => (
                  <details key={question}>
                    <summary>
                      <T>{question}</T>
                      <ChevronDown size={18} />
                    </summary>
                    <div className="faq-answer">
                      <p>
                        <T>{answer}</T>
                      </p>
                    </div>
                  </details>
                ))}
              </div>
            </section>
          )}
        </main>
      </MarketingMotion>
      <MarketingFooter
        authenticated={authenticated}
        supportEmail={supportEmail}
      />
    </div>
  );
}
