import Image from "next/image";
import Link from "next/link";
import { T } from "@/components/locale-provider";
import { productMedia } from "./product-media";
import { ProductInterface } from "./product-cinema";

export function ProductEvidence({
  cinematic = false,
}: {
  cinematic?: boolean;
}) {
  return (
    <section
      className="marketing-container marketing-section product-evidence"
      aria-labelledby="evidence-title"
    >
      <div className="marketing-section-heading" data-reveal>
        <div>
          <span className="marketing-eyebrow">
            <T>{"SCENARIU DEMONSTRATIV"}</T>
          </span>
          <h2 id="evidence-title">
            <T>{"Ce verifici la prima programare"}</T>
          </h2>
        </div>
        <p>
          <T>
            {
              "Un exemplu din produs, cu date fictive. Nu este un studiu de caz și nu măsoară rezultatele unei clinici."
            }
          </T>
        </p>
      </div>
      <div className="evidence-layout">
        <div>
          <ol className="evidence-steps" data-stagger>
            <li data-reveal="left">
              <h3>
                <T>{"Alegi medicul, serviciul și intervalul"}</T>
              </h3>
              <p>
                <T>
                  {
                    "Durata serviciului, programul medicului și resursa necesară determină intervalele disponibile. O programare este verificată înainte de salvare pentru a evita suprapunerile."
                  }
                </T>
              </p>
            </li>
            <li data-reveal="left">
              <h3>
                <T>{"Confirmi sau reprogramezi"}</T>
              </h3>
              <p>
                <T>
                  {
                    "Deschizi detaliile programării, verifici statusul și schimbi intervalul când este nevoie. Mesajul WhatsApp se deschide separat, iar recepția îl trimite manual."
                  }
                </T>
              </p>
            </li>
            <li data-reveal="left">
              <h3>
                <T>{"Consulți profilul și partajezi rezultatele"}</T>
              </h3>
              <p>
                <T>
                  {
                    "Colegul autorizat vede istoricul și documentele pacientului. Pacientul vede în portal doar informațiile proprii și rezultatele partajate explicit."
                  }
                </T>
              </p>
            </li>
          </ol>
          <Link href="/prezentare" className="marketing-text-link">
            <T>{"Explorează capturile din platformă"}</T> →
          </Link>
        </div>
        <figure data-reveal="right">
          {cinematic ? (
            <ProductInterface scene={2} />
          ) : (
            <Image
              src={productMedia["appointment-detail"]}
              alt="Detaliile unei programări fictive: pacient, medic, serviciu, status și acțiuni în Voxa-OS"
              sizes="(max-width: 800px) 90vw, 45vw"
            />
          )}
          <figcaption>
            <T>
              {cinematic
                ? "Date fictive · Prezentarea fluxului Voxa-OS"
                : "Captură din Voxa-OS. Identitățile și programările sunt demonstrative."}
            </T>
          </figcaption>
        </figure>
      </div>
      <div className="evidence-decisions" data-stagger>
        <article data-reveal>
          <h3>
            <T>{"Pentru clinici și cabinete care organizează consultații"}</T>
          </h3>
          <p>
            <T>
              {
                "Calendar comun, medici, servicii, locații, registru de pacienți și documente. Începe evaluarea cu un circuit simplu: recepție, medic și pacient fictiv."
              }
            </T>
          </p>
        </article>
        <article data-reveal>
          <h3>
            <T>{"Verifică aceste limite înainte de a alege"}</T>
          </h3>
          <p>
            <T>
              {
                "Voxa-OS nu oferă integrare CNAS/SIUI, prescripții electronice sau contabilitate. Nu este un sistem de diagnostic. SMS-ul necesită un furnizor separat, iar WhatsApp nu trimite automat mesaje."
              }
            </T>
          </p>
        </article>
      </div>
      <nav
        className="marketing-resource-links"
        aria-label="Detalii despre produs"
      >
        <Link href="/migrare">
          <T>{"Import și export de pacienți"}</T>
        </Link>
        <Link href="/securitate">
          <T>{"Roluri, documente și portal"}</T>
        </Link>
        <Link href="/integrari">
          <T>{"Integrări și limite"}</T>
        </Link>
      </nav>
    </section>
  );
}
