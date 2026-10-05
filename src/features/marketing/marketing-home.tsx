import Image from "next/image";
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
  CircleCheck,
  Workflow,
  ArrowDown,
  LockKeyhole,
} from "lucide-react";
import { T } from "@/components/locale-provider";
import { MarketingHeader } from "./marketing-header";
import { MarketingFooter } from "./marketing-footer";
import { MarketingMotion } from "./marketing-motion";
import { HeroPreview } from "./hero-preview";
import { ProductShowcase } from "./product-showcase";
import { MarketingROI } from "./marketing-roi";
import { MarketingPrice } from "./marketing-price";
import { MarketingContact } from "./marketing-contact";
import { marketingFaqs } from "./marketing-content";
import { productMedia } from "./product-media";

const modules = [
  {
    icon: CalendarDays,
    title: "Programări fără suprapuneri",
    body: "Calendar comun, disponibilitate și resurse. Fiecare programare își găsește locul.",
    detail: "Calendar & disponibilitate",
  },
  {
    icon: ContactRound,
    title: "Pacienți, cu tot contextul",
    body: "Date de contact, istoricul programărilor, documente și rezultate, în același profil.",
    detail: "Registru & profil pacient",
  },
  {
    icon: Stethoscope,
    title: "Echipa, în același ritm",
    body: "Medici, specialități și program de lucru. Recepția și medicul au un context comun.",
    detail: "Medici & servicii",
  },
  {
    icon: MessageSquare,
    title: "Comunicare la îndemână",
    body: "Confirmări, acces la WhatsApp și evidența comunicărilor. Mai puține informații pierdute.",
    detail: "Confirmări & comunicări",
  },
  {
    icon: FileText,
    title: "Documente bine organizate",
    body: "Documente private și rezultate versionate. Informațiile sunt disponibile colegilor autorizați.",
    detail: "Documente & rezultate",
  },
  {
    icon: Building2,
    title: "Locații conectate",
    body: "Gestionezi locațiile, cabinetele și resursele în cadrul aceleiași organizații.",
    detail: "Organizație & acces",
  },
];

export function MarketingHome({
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
    <div className="marketing-page premium-home">
      <a className="skip-link" href="#marketing-main">
        <T>{"Sari la conținut"}</T>
      </a>
      <MarketingHeader authenticated={authenticated} />
      <MarketingMotion>
        <main id="marketing-main">
          <section
            className="premium-hero marketing-container"
            aria-labelledby="hero-title"
          >
            <div className="premium-hero-copy">
              <h1 id="hero-title" className="hero-enter">
                <T>{"Mai puțină administrare."}</T>
                <br />
                <span>
                  <T>{"Mai mult timp pentru pacienți."}</T>
                </span>
              </h1>
              <p className="hero-description hero-enter">
                <T>
                  {
                    "Voxa-OS aduce programările, pacienții și echipa într-un singur spațiu de lucru. Claritate pentru recepție. Context pentru medici. Control pentru clinică."
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
            </div>
            <HeroPreview />
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

          <section
            className="premium-problem marketing-section"
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
                  <T>{"Tot ce ține clinica"}</T>
                  <br />
                  <T>{"în mișcare."}</T>
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
              {modules.map(({ icon: Icon, title, body, detail }) => (
                <article key={title} data-reveal>
                  <span className="module-icon">
                    <Icon size={22} strokeWidth={1.5} />
                  </span>
                  <h3>
                    <T>{title}</T>
                  </h3>
                  <p>
                    <T>{body}</T>
                  </p>
                  <span className="module-detail">
                    <T>{detail}</T>
                    <ArrowUpRight size={13} />
                  </span>
                </article>
              ))}
            </div>
          </section>

          <section
            id="platforma"
            className="marketing-demo-section premium-showcase"
            aria-labelledby="showcase-title"
          >
            <div className="marketing-container">
              <div className="marketing-section-heading" data-reveal>
                <div>
                  <span className="marketing-eyebrow">
                    <span className="live-dot" />
                    <T>{"PRODUS REAL. CONTEXT REAL."}</T>
                  </span>
                  <h2 id="showcase-title">
                    <T>{"O imagine clară."}</T>
                    <br />
                    <T>{"De la prima oră."}</T>
                  </h2>
                </div>
                <p>
                  <T>
                    {
                      "Programările zilei, statusurile și situațiile care cer atenție. Explorează interfața reală, de la dashboard la profilul pacientului."
                    }
                  </T>
                </p>
              </div>
              <div data-reveal>
                <ProductShowcase videoSrc={videoSrc} />
              </div>
            </div>
          </section>

          <section
            id="cum-functioneaza"
            className="marketing-container marketing-section premium-workflow"
            aria-labelledby="home-workflow-title"
          >
            <div className="workflow-copy" data-reveal>
              <span className="marketing-eyebrow">
                <T>{"DE LA PROGRAMARE LA PACIENT"}</T>
              </span>
              <h2 id="home-workflow-title">
                <T>{"Un flux firesc."}</T>
                <br />
                <T>{"Pentru întreaga echipă."}</T>
              </h2>
              <p>
                <T>
                  {
                    "Fiecare pas are locul lui. Informația însoțește pacientul, iar echipa știe unde să o găsească."
                  }
                </T>
              </p>
              <ol className="premium-workflow-steps" data-stagger>
                {[
                  [
                    "Alegi un interval disponibil",
                    "Calendarul ține cont de medic, serviciu și resursele necesare.",
                  ],
                  [
                    "Recepția coordonează programarea",
                    "Detaliile, confirmarea și reprogramarea rămân în același context.",
                  ],
                  [
                    "Medicul are istoricul la îndemână",
                    "Profilul pacientului reunește programări, documente și rezultate.",
                  ],
                ].map(([title, body], index) => (
                  <li key={title} data-reveal>
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
              <Link className="marketing-text-link" href="/cum-functioneaza">
                <T>{"Vezi cum începi"}</T>
                <ArrowUpRight size={16} />
              </Link>
            </div>
            <figure className="premium-patient-visual" data-reveal>
              <div className="patient-visual-label">
                <ContactRound size={16} />
                <T>{"PACIENTUL, ÎN CENTRUL FLUXULUI"}</T>
              </div>
              <div
                className="patient-screen"
                tabIndex={0}
                role="region"
                aria-label="Profil pacient — captură reală, derulare orizontală pentru detalii"
              >
                <Image
                  src={productMedia["patient-profile"]}
                  alt="Profilul real al unui pacient demonstrativ în Voxa-OS, cu istoricul programărilor"
                  sizes="(max-width: 760px) 800px, 720px"
                />
              </div>
              <figcaption>
                <CircleCheck size={15} />
                <T>{"Același context pentru colegii autorizați."}</T>
              </figcaption>
            </figure>
          </section>

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
