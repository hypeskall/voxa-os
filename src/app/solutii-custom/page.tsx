import { marketingContext } from "@/features/marketing/render-page";
import type { Metadata } from "next";
import { MarketingHeader } from "@/features/marketing/marketing-header";
import { MarketingFooter } from "@/features/marketing/marketing-footer";
import { CustomRequest } from "@/features/marketing/custom-request";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  CalendarDays,
  Workflow,
  PanelsTopLeft,
  Plug,
  Mail,
  Phone,
  CheckCircle2,
} from "lucide-react";
import "./custom.css";

export const metadata: Metadata = {
  title: "Voxa Custom — Soluții personalizate pentru clinici",
  description:
    "Website-uri, aplicații și automatizări personalizate pentru medici și clinici. Spune-ne ce ai nevoie și hai să discutăm proiectul tău.",
  robots: {
    index:
      process.env.APP_ENVIRONMENT !== "staging" &&
      process.env.VERCEL_ENV !== "preview",
    follow: true,
  },
};

export default async function Page() {
  const { authenticated, supportEmail } = await marketingContext();
  return (
    <div className="marketing-page custom-page">
      <MarketingHeader
        authenticated={authenticated}
        primaryAction={{ href: "#cerere", label: "Discută proiectul" }}
      />
      <main>
        <section className="custom-hero marketing-container">
          <div className="custom-hero-copy">
            <span className="custom-eyebrow">
              <span className="custom-dot" /> VOXA CUSTOM
            </span>
            <h1>
              O clinică unică.
              <br />O soluție <em>pe măsură.</em>
            </h1>
            <p>
              Construim website-uri, aplicații și automatizări pentru medici și
              clinici. Pornim de la felul în care lucrezi și de la ce are nevoie
              echipa ta.
            </p>
            <div className="custom-hero-actions">
              <a className="custom-button" href="#cerere">
                Hai să discutăm proiectul <ArrowUpRight size={18} />
              </a>
              <a className="custom-text-link" href="#solutii">
                Explorează soluțiile <ArrowRight size={16} />
              </a>
            </div>
            <div className="custom-hero-proof">
              <span>
                <Check size={14} /> Adaptat clinicii tale
              </span>
              <span>
                <Check size={14} /> Ofertă înainte de dezvoltare
              </span>
            </div>
          </div>
          <div
            className="custom-visual"
            aria-label="Concept demonstrativ de aplicație pentru clinică, cu date fictive"
          >
            <div className="custom-visual-caption">
              <span>DE LA IDEE LA INTERFAȚĂ</span>
              <span>CONCEPT ILUSTRATIV</span>
            </div>
            <div className="custom-app">
              <div className="custom-app-bar">
                <span className="custom-app-dots">
                  <i />
                  <i />
                  <i />
                </span>
                <span>clinica-ta / spațiu de lucru</span>
                <span className="custom-avatar">CT</span>
              </div>
              <div className="custom-app-content">
                <div className="custom-app-heading">
                  <div>
                    <span>BUNĂ DIMINEAȚA, ECHIPĂ</span>
                    <h2>Totul începe cu un plan.</h2>
                  </div>
                  <CalendarDays size={23} />
                </div>
                <div className="custom-app-stats">
                  <div>
                    <span>Programări</span>
                    <strong>
                      12 <small>astăzi</small>
                    </strong>
                  </div>
                  <div>
                    <span>Confirmate</span>
                    <strong>
                      10 <small>din 12</small>
                    </strong>
                  </div>
                  <div>
                    <span>Cabinete</span>
                    <strong>
                      03 <small>active</small>
                    </strong>
                  </div>
                </div>
                <div className="custom-app-schedule">
                  <div>
                    <strong>Agenda clinicii</strong>
                    <span>Date demonstrative</span>
                  </div>
                  {[
                    ["09:00", "Consultație inițială", "Cabinet 01"],
                    ["09:30", "Control periodic", "Cabinet 02"],
                    ["10:00", "Consultație de specialitate", "Cabinet 01"],
                  ].map(([time, title, room]) => (
                    <div className="custom-app-appointment" key={time}>
                      <time>{time}</time>
                      <span>
                        <strong>{title}</strong>
                        <small>{room}</small>
                      </span>
                      <span className="custom-confirmed">
                        <Check size={12} /> Confirmată
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="custom-floating">
              <span>
                <Workflow size={19} />
              </span>
              <div>
                <strong>Un pas mai puțin pentru recepție.</strong>
                <p>Exemplu: confirmări automate de programare</p>
              </div>
              <CheckCircle2 size={20} />
            </div>
            <div className="custom-visual-bottom">
              <span>IDENTITATEA TA</span>
              <span>FLUXURILE TALE</span>
              <span>ECHIPA TA</span>
            </div>
          </div>
        </section>
        <div className="custom-audience marketing-container">
          <span>PENTRU FELUL TĂU DE A LUCRA</span>
          <p>Cabinete individuale</p>
          <span className="custom-audience-divider" />
          <p>Clinici medicale</p>
          <span className="custom-audience-divider" />
          <p>Echipe cu mai multe locații</p>
        </div>
        <section
          id="solutii"
          className="custom-options marketing-container"
          aria-labelledby="custom-options-title"
        >
          <div className="custom-section-heading">
            <div>
              <span className="custom-eyebrow">CE PUTEM CONSTRUI ÎMPREUNĂ</span>
              <h2 id="custom-options-title">
                De la prima impresie
                <br />
                la ultimul pas din cabinet.
              </h2>
            </div>
            <p className="custom-intro">
              Un website mai bun pentru pacienți. Un instrument mai simplu
              pentru echipă. Sau legătura care lipsește între ele.
            </p>
          </div>
          <div className="custom-option-grid">
            {[
              [
                PanelsTopLeft,
                "Website & portal pacient",
                "Un site cu identitatea clinicii, servicii ușor de găsit și formulare care fac primul contact mai simplu.",
              ],
              [
                CalendarDays,
                "Aplicații pentru clinică",
                "Programări, cabinete și fluxuri interne organizate după regulile echipei tale, într-un spațiu de lucru dedicat.",
              ],
              [
                Workflow,
                "Automatizări utile",
                "Confirmări, cereri și sarcini repetitive. Alegem împreună ce merită automatizat și unde trebuie păstrat controlul uman.",
              ],
              [
                Plug,
                "Instrumente care comunică",
                "Analizăm conectarea aplicațiilor existente și transferul datelor, în funcție de accesul și API-urile disponibile.",
              ],
            ].map(([Icon, title, body], index) => {
              const Symbol = Icon as typeof Workflow;
              return (
                <article key={String(title)}>
                  <div className="custom-option-top">
                    <span>
                      <Symbol size={23} strokeWidth={1.5} />
                    </span>
                    <small>0{index + 1}</small>
                  </div>
                  <h3>{String(title)}</h3>
                  <p>{String(body)}</p>
                  <a href="#cerere">
                    Discută această idee <ArrowUpRight size={15} />
                  </a>
                </article>
              );
            })}
          </div>
          <p className="custom-scope-note">
            Fiecare proiect începe cu o evaluare. Funcțiile, integrările și
            costurile se confirmă în ofertă.
          </p>
        </section>
        <section className="custom-process">
          <div className="marketing-container">
            <span className="custom-eyebrow">O COLABORARE CLARĂ</span>
            <h2>De la „ar fi util” la un plan concret.</h2>
            <div className="custom-steps">
              {[
                [
                  "01",
                  "Înțelegem clinica",
                  "Ne spui cum lucrați, ce vă încetinește și ce ai vrea să schimbi.",
                ],
                [
                  "02",
                  "Definim proiectul",
                  "Stabilim funcțiile, limitele, etapele și o ofertă înainte să înceapă dezvoltarea.",
                ],
                [
                  "03",
                  "Construim și ajustăm",
                  "Verificăm fluxurile cu echipa ta, folosind date demonstrative, apoi pregătim implementarea.",
                ],
              ].map(([number, title, body]) => (
                <article key={number}>
                  <span>{number}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section id="cerere" className="custom-contact marketing-container">
          <div className="custom-contact-copy">
            <span className="custom-eyebrow">PROIECTUL TĂU ÎNCEPE AICI</span>
            <h2>
              Tu cunoști clinica.
              <br />
              <em>Hai să-i găsim soluția.</em>
            </h2>
            <p>
              Spune-ne ce ai în minte, chiar dacă este doar o idee. Nu ai nevoie
              de un brief tehnic ca să începem o conversație.
            </p>
            <div className="custom-contact-promise">
              <Check size={17} />
              <span>
                Discutăm întâi nevoia, apoi propunem o direcție, un buget și
                etapele proiectului.
              </span>
            </div>
            <div className="custom-direct-contact">
              <span>PREFERI SĂ NE CONTACTEZI DIRECT?</span>
              <a href={`mailto:${supportEmail || "contact@voxatech.ro"}`}>
                <Mail size={18} />
                {supportEmail || "contact@voxatech.ro"}
                <ArrowUpRight size={16} />
              </a>
              <a href="tel:+40770541817">
                <Phone size={18} />
                +40 770 541 817
                <ArrowUpRight size={16} />
              </a>
            </div>
          </div>
          <CustomRequest email={supportEmail || "contact@voxatech.ro"} />
        </section>
        <section className="custom-faq marketing-container">
          <h2>Înainte să ne scrii</h2>
          <details>
            <summary>Pot cere o soluție pentru un singur cabinet?</summary>
            <p>
              Da. Spune-ne ce activitate vrei să simplifici și câte persoane vor
              folosi soluția.
            </p>
          </details>
          <details>
            <summary>Trebuie să folosesc deja Voxa-OS?</summary>
            <p>
              Nu. Putem discuta atât o adaptare în jurul Voxa-OS, cât și un
              proiect separat, în funcție de cerințe.
            </p>
          </details>
          <details>
            <summary>Pot trimite date despre pacienți?</summary>
            <p>
              Pentru prima discuție, folosește doar exemple fictive. Cerințele
              de acces, securitate și prelucrare a datelor se stabilesc înaintea
              implementării.
            </p>
          </details>
        </section>
      </main>
      <MarketingFooter authenticated={authenticated} />
    </div>
  );
}
