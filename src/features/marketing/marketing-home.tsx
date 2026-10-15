import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
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
  Check,
  FileText,
  Workflow,
  ArrowDown,
  LockKeyhole,
} from "lucide-react";
import { T } from "@/components/locale-provider";
import { MarketingHeader } from "./marketing-header";
import { MarketingFooter } from "./marketing-footer";
import { MarketingMotion } from "./marketing-motion";
import { ProductCinema } from "./product-cinema";
import { MarketingROI } from "./marketing-roi";
import { MarketingPrice } from "./marketing-price";
import { MarketingContact } from "./marketing-contact";
import { marketingFaqs } from "./marketing-content";
import { WorkflowStory } from "./workflow-story";
import { IntegrationStrip } from "./integrations";
import { PrelaunchNotice } from "./prelaunch-notice";
import { ProductEvidence } from "./product-evidence";

const modules = [
  {
    icon: CalendarDays,
    title: "Programări fără suprapuneri",
    body: "Calendar comun, disponibilitate și resurse. Fiecare programare își găsește locul.",
    detail: "Calendar & disponibilitate",
    href: "/functionalitati#functionalitati",
  },
  {
    icon: ContactRound,
    title: "Pacienți, cu tot contextul",
    body: "Date de contact, istoricul programărilor, documente și rezultate, în același profil.",
    detail: "Registru & profil pacient",
    href: "/migrare",
  },
  {
    icon: Stethoscope,
    title: "Echipa, în același ritm",
    body: "Medici, specialități și program de lucru. Recepția și medicul au un context comun.",
    detail: "Medici & servicii",
    href: "/cum-functioneaza",
  },
  {
    icon: MessageSquare,
    title: "Comunicare la îndemână",
    body: "Mesaje WhatsApp pregătite pentru trimitere manuală și evidența comunicărilor. Recepția verifică și trimite fiecare mesaj.",
    detail: "Confirmări & comunicări",
    href: "/integrari#whatsapp",
  },
  {
    icon: FileText,
    title: "Documente bine organizate",
    body: "Documente private și rezultate versionate. Informațiile sunt disponibile colegilor autorizați.",
    detail: "Documente & rezultate",
    href: "/securitate",
  },
  {
    icon: Building2,
    title: "Locații conectate",
    body: "Gestionezi locațiile, cabinetele și resursele în cadrul aceleiași organizații.",
    detail: "Organizație & acces",
    href: "/securitate",
  },
];

export function MarketingHome({
  authenticated,
  supportEmail,
}: {
  authenticated: boolean;
  videoSrc?: string;
  supportEmail?: string;
}) {
  const destination = authenticated ? "/dashboard" : "/register";
  const cta = authenticated ? "Deschide platforma" : "Începe testarea gratuită";
  return (
    <div className="marketing-page premium-home">
      <a className="skip-link" href="#marketing-main">
        <T>{"Sari la conținut"}</T>
      </a>
      <MarketingHeader authenticated={authenticated} />
      <MarketingMotion cinematic>
        <main id="marketing-main">
          <section
            className="premium-hero marketing-container"
            data-scroll-scene
            aria-labelledby="hero-title"
          >
            <div className="luxury-hero-atmosphere" aria-hidden="true">
              <i />
              <i />
              <span />
            </div>
            <div className="premium-hero-copy">
              <div className="luxury-hero-kicker hero-enter">
                <span /> VOXA-OS{" "}
                <span className="luxury-kicker-divider">/</span>
                <T>{"Spațiul clinicii tale"}</T>
              </div>
              <h1 id="hero-title" className="hero-enter">
                <span className="luxury-title-line">
                  <T>{"Software pentru clinici medicale."}</T>
                </span>
                <span className="luxury-title-emphasis">
                  <T>{"Mai mult timp pentru pacienți."}</T>
                </span>
              </h1>
              <p className="hero-description hero-enter">
                <T>
                  {
                    "Programări medicale, registrul pacienților, documente și echipă, în același loc. Un calendar pentru recepție și un portal pentru pacient."
                  }
                </T>
              </p>
              <div className="marketing-actions hero-enter">
                <Link
                  href={destination}
                  className="marketing-button is-primary"
                >
                  <T>{cta}</T>
                  <ArrowRight size={17} />
                </Link>
                <Link
                  href="#platforma"
                  className="marketing-button is-secondary"
                >
                  <Play size={14} />
                  <T>{"Explorează platforma"}</T>
                </Link>
              </div>
              <p className="hero-trial hero-enter">
                <Check size={14} />
                <T>{"30 de zile gratuit"}</T>
                <span>·</span>
                <T>{"Fără card"}</T>
                <span>·</span>
                <T>{"19,99 EUR / lună după testare"}</T>
              </p>
              <PrelaunchNotice />
            </div>
            <div className="cinema-hero-scroll-cue">
              <ArrowDown size={16} />
              <T>{"Derulează pentru a explora"}</T>
            </div>
            <ProductCinema />
            <div className="premium-audience">
              <span>
                <T>{"UN MOD DE LUCRU COMUN PENTRU"}</T>
              </span>
              <div>
                <span>
                  <Building2 size={18} />
                  <T>{"Clinici medicale"}</T>
                </span>
                <span>
                  <Stethoscope size={18} />
                  <T>{"Cabinete individuale"}</T>
                </span>
                <span>
                  <Workflow size={18} />
                  <T>{"Centre de investigații"}</T>
                </span>
              </div>
            </div>
          </section>

          <IntegrationStrip />

          <section
            className="premium-problem marketing-section"
            data-scroll-scene
            aria-labelledby="problem-title"
          >
            <div className="marketing-container">
              <div className="marketing-section-heading" data-reveal>
                <div>
                  <span className="marketing-eyebrow">
                    <T>{"MAI PUȚINĂ FRAGMENTARE"}</T>
                  </span>
                  <h2 id="problem-title">
                    <T>{"Clinica ta e conectată."}</T>
                    <br />
                    <T>{"Instrumentele ar trebui să fie la fel."}</T>
                  </h2>
                </div>
                <p>
                  <T>
                    {
                      "Când programările sunt într-un loc, documentele în altul, iar detaliile rămân în conversații, echipa pierde timp. Voxa-OS aduce contextul împreună."
                    }
                  </T>
                </p>
              </div>
              <div className="problem-grid" data-stagger>
                {[
                  [
                    "01",
                    "Din agende separate",
                    "într-un calendar comun.",
                    "Programul medicilor și disponibilitatea resurselor, în aceeași vedere.",
                  ],
                  [
                    "02",
                    "Din informații dispersate",
                    "într-un profil complet.",
                    "Pacientul, programările și documentele lui, ușor de regăsit.",
                  ],
                  [
                    "03",
                    "Din verificări repetate",
                    "într-un flux coerent.",
                    "Recepția, medicul și administratorul lucrează cu același context.",
                  ],
                ].map(([number, before, after, body]) => (
                  <article key={number} data-reveal>
                    <span className="problem-index">
                      {number}
                      <ArrowDown size={15} />
                    </span>
                    <h3>
                      <span>
                        <T>{before}</T>
                      </span>
                      <br />
                      <T>{after}</T>
                    </h3>
                    <p>
                      <T>{body}</T>
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section
            className="marketing-container premium-product-intro"
            aria-labelledby="intro-title"
          >
            <div data-reveal>
              <span className="marketing-eyebrow">
                <T>{"ACESTA ESTE VOXA-OS"}</T>
              </span>
              <h2 id="intro-title">
                <T>{"Spațiul de lucru al clinicii."}</T>
              </h2>
              <p>
                <T>
                  {
                    "De la prima programare la documentele pacientului. Un singur loc în care informațiile se leagă, iar echipa poate lucra împreună."
                  }
                </T>
              </p>
            </div>
            <ol className="product-intro-flow" data-stagger>
              {[
                { icon: CalendarDays, label: "Programări" },
                { icon: ContactRound, label: "Pacienți" },
                { icon: Stethoscope, label: "Echipă" },
                { icon: FileText, label: "Documente" },
              ].map(({ icon: Icon, label }, index) => (
                <li key={label} data-reveal>
                  <span>
                    <Icon size={22} strokeWidth={1.5} />
                  </span>
                  <strong>
                    <T>{label}</T>
                  </strong>
                  {index < 3 && (
                    <ArrowRight
                      className="intro-flow-arrow"
                      size={14}
                      aria-hidden="true"
                    />
                  )}
                </li>
              ))}
            </ol>
          </section>

          <div
            className="luxury-type-ribbon"
            data-scroll-scene
            aria-hidden="true"
          >
            <div className="luxury-type-track">
              {[0, 1].map((copy) => (
                <span key={copy}>
                  {["Programări", "Pacienți", "Echipă", "Documente"].map(
                    (label) => (
                      <span key={label}>
                        <T>{label}</T>
                        <i />
                      </span>
                    ),
                  )}
                </span>
              ))}
            </div>
          </div>

          <section
            id="functionalitati"
            className="marketing-container marketing-section premium-modules"
            aria-labelledby="modules-title"
          >
            <div className="marketing-section-heading" data-reveal>
              <div>
                <span className="marketing-eyebrow">
                  <T>{"O SINGURĂ PLATFORMĂ"}</T>
                </span>
                <h2 id="modules-title">
                  <T>{"Programări, documente și echipă."}</T>
                  <br />
                  <T>{"Într-un singur software."}</T>
                </h2>
              </div>
              <div className="modules-heading-detail">
                <p>
                  <T>
                    {
                      "Instrumentele de zi cu zi, construite în jurul modului în care lucrează echipa ta."
                    }
                  </T>
                </p>
                <Link className="marketing-text-link" href="/functionalitati">
                  <T>{"Toate funcționalitățile"}</T>
                  <ArrowUpRight size={16} />
                </Link>
              </div>
            </div>
            <div className="premium-module-grid" data-stagger>
              {modules.map(({ icon: Icon, title, body, detail, href }) => (
                <article key={title} data-reveal="scale">
                  <span className="module-icon">
                    <Icon size={22} strokeWidth={1.5} />
                  </span>
                  <h3>
                    <T>{title}</T>
                  </h3>
                  <p>
                    <T>{body}</T>
                  </p>
                  <Link href={href} className="module-detail">
                    <T>{detail}</T>
                    <ArrowUpRight size={13} />
                  </Link>
                </article>
              ))}
            </div>
          </section>

          <WorkflowStory />

          <ProductEvidence cinematic />
          <MarketingROI />

          <section
            className="premium-security"
            aria-labelledby="home-security-title"
          >
            <div className="marketing-container marketing-section">
              <div className="marketing-section-heading" data-reveal>
                <div>
                  <span className="marketing-eyebrow">
                    <ShieldCheck size={14} />
                    <T>{"ÎNCREDERE PRIN CONTROL"}</T>
                  </span>
                  <h2 id="home-security-title">
                    <T>{"Informații sensibile."}</T>
                    <br />
                    <T>{"Acces bine definit."}</T>
                  </h2>
                </div>
                <p>
                  <T>
                    {
                      "Administrarea unei clinici cere responsabilitate. Voxa-OS include controale concrete pentru accesul la informații și pentru activitatea echipei."
                    }
                  </T>
                </p>
              </div>
              <div className="premium-security-grid" data-stagger>
                {[
                  {
                    icon: KeyRound,
                    title: "Permisiuni pe roluri",
                    body: "Acces distinct pentru proprietar, administrator, recepție și medic.",
                  },
                  {
                    icon: LockKeyhole,
                    title: "Verificare în doi pași",
                    body: "Protecție suplimentară a contului, activabilă din setările de securitate.",
                  },
                  {
                    icon: Building2,
                    title: "Contextul clinicii",
                    body: "Acces verificat la organizație și la locațiile autorizate.",
                  },
                  {
                    icon: History,
                    title: "Istoric operațional",
                    body: "Modificările programărilor și acțiunile relevante sunt înregistrate.",
                  },
                ].map(({ icon: Icon, title, body }) => (
                  <article key={title} data-reveal>
                    <Icon size={21} strokeWidth={1.5} />
                    <h3>
                      <T>{title}</T>
                    </h3>
                    <p>
                      <T>{body}</T>
                    </p>
                  </article>
                ))}
              </div>
              <Link className="marketing-text-link" href="/legal/privacy">
                <T>{"Informații despre confidențialitate"}</T>
                <ArrowUpRight size={15} />
              </Link>
            </div>
          </section>

          <MarketingPrice authenticated={authenticated} />

          <section
            id="intrebari"
            className="marketing-container marketing-section marketing-faq"
            aria-labelledby="home-faq-title"
          >
            <div data-reveal>
              <span className="marketing-eyebrow">
                <T>{"ÎNAINTE SĂ ÎNCEPI"}</T>
              </span>
              <h2 id="home-faq-title">
                <T>{"Întrebări firești."}</T>
                <br />
                <T>{"Răspunsuri clare."}</T>
              </h2>
              <p>
                <T>
                  {
                    "Detaliile care contează când alegi un nou mod de lucru pentru clinică."
                  }
                </T>
              </p>
              <Link href="/help" className="marketing-text-link">
                <T>{"Ai nevoie de ajutor?"}</T>
                <ArrowUpRight size={16} />
              </Link>
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

          <MarketingContact />

          <section
            className="marketing-final-section premium-final"
            data-scroll-scene
            aria-labelledby="final-title"
          >
            <div className="marketing-container" data-reveal>
              <span className="hero-pill">
                <Workflow size={14} />
                VOXA-OS
              </span>
              <h2 id="final-title">
                <T>{"O clinică mai organizată."}</T>
                <br />
                <span>
                  <T>{"Mai mult loc pentru pacienți."}</T>
                </span>
              </h2>
              <p>
                <T>
                  {
                    "Descoperă ce poate face un spațiu de lucru comun pentru echipa ta."
                  }
                </T>
              </p>
              <div className="marketing-actions">
                <Link href={destination} className="marketing-button is-light">
                  <T>{cta}</T>
                  <ArrowRight size={17} />
                </Link>
                <Link href="/prezentare" className="marketing-final-login">
                  <T>{"Vezi prezentarea"}</T>
                  <ArrowUpRight size={16} />
                </Link>
              </div>
              <span className="final-trial">
                <T>{"30 de zile gratuit. Fără card. În ritmul tău."}</T>
              </span>
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
