import Image from "next/image";
import Link from "next/link";
import { T } from "@/components/locale-provider";
import { MarketingHeader } from "./marketing-header";
import { MarketingFooter } from "./marketing-footer";
import { marketingContext } from "./render-page";
import { MarketingSchema } from "./seo";
import { PrelaunchNotice } from "./prelaunch-notice";
import { integrations } from "./integrations";

const headings = {
  integrari: "Integrări și servicii în Voxa-OS",
  securitate: "Cine poate accesa datele clinicii",
  migrare: "Import pacienți din Excel sau CSV",
} as const;
type Resource = keyof typeof headings;

export async function ResourcePage({ page }: { page: Resource }) {
  const { authenticated, supportEmail } = await marketingContext();
  return (
    <div className="marketing-page marketing-subpage">
      <MarketingSchema page={page} />
      <a href="#marketing-main" className="skip-link">
        <T>{"Sari la conținut"}</T>
      </a>
      <MarketingHeader authenticated={authenticated} />
      <main
        id="marketing-main"
        className="marketing-container marketing-resource"
      >
        <div className="marketing-page-intro">
          <Link href="/" className="marketing-text-link">
            <T>{"Pagina principală"}</T> →
          </Link>
          <h1>
            <T>{headings[page]}</T>
          </h1>
          <PrelaunchNotice />
        </div>
        {page === "integrari" && (
          <>
            <p className="resource-lead">
              <T>
                {
                  "Voxa-OS folosește aceste servicii pentru funcții precise. Logourile identifică furnizorii; ele nu indică o certificare, un parteneriat sau o recomandare a produsului."
                }
              </T>
            </p>
            <div className="resource-integration-grid">
              {integrations.map((brand) => (
                <section
                  id={brand.name.toLowerCase()}
                  className="resource-card"
                  key={brand.name}
                >
                  <Image
                    src={brand.logo}
                    width={brand.width}
                    height={brand.height}
                    alt={brand.name}
                  />
                  <h2>
                    <T>{brand.role}</T>
                  </h2>
                  <p>
                    <T>{brand.detail}</T>
                  </p>
                  <a href={brand.url}>
                    <T>{"Documentație oficială"}</T> · {brand.name} ↗
                  </a>
                </section>
              ))}
            </div>
            <section className="resource-section">
              <h2>
                <T>{"Email, fișiere și limite de integrare"}</T>
              </h2>
              <p>
                <T>
                  {
                    "Emailurile tranzacționale folosesc Brevo. Acceptarea unui email de către serviciul de trimitere nu garantează că acesta ajunge în Inbox. Mesajele nu trebuie să includă rezultate medicale sau alte date sensibile."
                  }
                </T>
              </p>
              <p>
                <T>
                  {
                    "Importul registrului de pacienți folosește fișiere CSV sau Excel (.xlsx). Nu există sincronizare continuă cu Excel, import automat de documente sau conectare la CNAS/SIUI. SMS-ul nu este disponibil fără un furnizor separat."
                  }
                </T>
              </p>
              <Link href="/migrare">
                <T>{"Vezi pașii și limitele importului"}</T> →
              </Link>
            </section>
          </>
        )}
        {page === "securitate" && (
          <>
            <p className="resource-lead">
              <T>
                {
                  "Protecția datelor începe cu accesul acordat fiecărui coleg. Verifică rolurile și circuitul documentelor într-o clinică demonstrativă înainte de utilizarea operațională."
                }
              </T>
            </p>
            <section className="resource-section">
              <h2>
                <T>{"Roluri și separarea clinicilor"}</T>
              </h2>
              <p>
                <T>
                  {
                    "Contul trebuie să fie autentificat și să aibă apartenență la clinica accesată. Rolurile proprietar, administrator, recepție și medic stabilesc operațiile disponibile. Verificările se aplică și accesului la date și documente, nu doar butoanelor afișate."
                  }
                </T>
              </p>
              <p>
                <T>
                  {
                    "Invită fiecare coleg în propriul cont. Nu partaja parola recepției cu întreaga echipă. Proprietarul gestionează accesul organizației și trebuie să revizuiască apartenențele când un coleg pleacă."
                  }
                </T>
              </p>
            </section>
            <section className="resource-section">
              <h2>
                <T>{"Autentificare în doi pași"}</T>
              </h2>
              <p>
                <T>
                  {
                    "Verificarea în doi pași se activează din cont, cu o aplicație de autentificare. După activare, accesul protejat necesită verificarea celui de-al doilea factor. Fiecare utilizator își configurează propriul factor."
                  }
                </T>
              </p>
              <Link href="/help">
                <T>{"Consultă ajutorul pentru cont"}</T> →
              </Link>
            </section>
            <section className="resource-section">
              <h2>
                <T>{"Documente private și portalul pacientului"}</T>
              </h2>
              <p>
                <T>
                  {
                    "Documentele sunt stocate privat. Se acceptă PDF, PNG, JPEG și WebP, cu maximum 3 MB per fișier. Rezultatele au versiuni și sunt vizibile pacientului numai după partajare explicită."
                  }
                </T>
              </p>
              <p>
                <T>
                  {
                    "Portalul folosește o identitate separată pentru pacient. Acesta consultă programările proprii și rezultatele partajate, fără acces la registrul altor pacienți sau la spațiul de lucru al echipei."
                  }
                </T>
              </p>
            </section>
            <section className="resource-section">
              <h2>
                <T>{"Export și responsabilități înainte de lansare"}</T>
              </h2>
              <p>
                <T>
                  {
                    "Proprietarul poate exporta datele unui pacient în JSON și poate descărca separat documentele originale. Copiile exportate trebuie păstrate de clinică într-un loc cu acces controlat."
                  }
                </T>
              </p>
              <p>
                <T>
                  {
                    "Voxa-OS este în pre-lansare. Documentele juridice sunt proiecte, iar condițiile comerciale și acordul de prelucrare trebuie finalizate înainte de introducerea datelor reale. Funcțiile prezentate nu reprezintă o certificare de conformitate sau o garanție de disponibilitate."
                  }
                </T>
              </p>
              <div className="marketing-resource-links">
                <Link href="/legal/privacy">
                  <T>{"Politica de confidențialitate"}</T>
                </Link>
                <Link href="/legal/data-processing">
                  <T>{"Proiectul acordului de prelucrare"}</T>
                </Link>
                <Link href="/legal/privacy#recipients">
                  <T>{"Furnizori și subîmputerniciți"}</T>
                </Link>
              </div>
            </section>
          </>
        )}
        {page === "migrare" && (
          <>
            <p className="resource-lead">
              <T>
                {
                  "Importul transferă registrul administrativ de pacienți, nu istoricul medical sau documentele. În pre-lansare, verifică procesul numai cu date fictive."
                }
              </T>
            </p>
            <section className="resource-section">
              <h2>
                <T>{"1. Pregătește fișierul de pacienți"}</T>
              </h2>
              <p>
                <T>
                  {
                    "Folosește CSV sau Excel (.xlsx), maximum 2 MB, o singură foaie și cel mult 500 de rânduri. În CSV sunt acceptate separatorul virgulă și punct și virgulă. Nu include formule sau legături în celule."
                  }
                </T>
              </p>
              <div className="resource-table-wrap">
                <table>
                  <caption>
                    <T>{"Coloanele modelului de import"}</T>
                  </caption>
                  <thead>
                    <tr>
                      <th>
                        <T>{"Coloană"}</T>
                      </th>
                      <th>
                        <T>{"Ce conține"}</T>
                      </th>
                      <th>
                        <T>{"Obligatorie"}</T>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["name", "Numele pacientului (2–160 de caractere)", "Da"],
                      [
                        "internal_id",
                        "Identificatorul intern al clinicii (1–50 de caractere)",
                        "Da",
                      ],
                      [
                        "birth_date",
                        "Data nașterii în format AAAA-LL-ZZ",
                        "Nu",
                      ],
                      ["phone", "Numărul de telefon", "Nu"],
                      ["email", "Adresa de email", "Nu"],
                    ].map(([field, meaning, required]) => (
                      <tr key={field}>
                        <td>
                          <code>{field}</code>
                        </td>
                        <td>
                          <T>{meaning}</T>
                        </td>
                        <td>
                          <T>{required}</T>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                <T>
                  {
                    "Păstrează exact antetele de mai sus. Folosește identificatorii clinicii pentru a recunoaște înregistrările existente, nu un identificator inventat la fiecare import."
                  }
                </T>
              </p>
              <Link href="/templates/patients-import.csv" download>
                <T>{"Descarcă modelul CSV"}</T> ↓
              </Link>
            </section>
            <section className="resource-section">
              <h2>
                <T>{"2. Verifică previzualizarea și erorile"}</T>
              </h2>
              <p>
                <T>
                  {
                    "Din registrul pacienților, alegi importul și încarci fișierul. Revizuiești rândurile noi, duplicatele și erorile înainte să confirmi. Corectează în fișier valorile respinse și repetă previzualizarea."
                  }
                </T>
              </p>
            </section>
            <section className="resource-section">
              <h2>
                <T>{"3. Confirmă importul și verifică un profil"}</T>
              </h2>
              <p>
                <T>
                  {
                    "Importul final adaugă rândurile validate și omite duplicatele identificate. După confirmare, verifică numele, identificatorul și datele de contact într-un profil nou. Păstrează o copie a fișierului sursă într-un loc sigur."
                  }
                </T>
              </p>
              <p>
                <T>
                  {
                    "Pentru liste mai mari, împarte fișierul în loturi de cel mult 500 de rânduri. Documentele, rezultatele și programările se configurează separat; nu sunt migrate prin acest import."
                  }
                </T>
              </p>
            </section>
            <section className="resource-section">
              <h2>
                <T>{"Cum scoți datele din platformă"}</T>
              </h2>
              <p>
                <T>
                  {
                    "Proprietarul organizației poate exporta datele unui pacient în JSON din zona de confidențialitate a profilului. Documentele originale se descarcă separat. Acest export nu este un fișier CSV pentru toate clinicile și nu transferă automat datele într-un alt software."
                  }
                </T>
              </p>
              <Link href="/securitate">
                <T>{"Verifică accesul și protecția documentelor"}</T> →
              </Link>
            </section>
          </>
        )}
        <section className="resource-next">
          <h2>
            <T>{"Evaluează circuitul clinicii cu date fictive"}</T>
          </h2>
          <p>
            <T>
              {
                "Testează o locație, un medic, un pacient și o programare. Compară ce ai nevoie cu funcțiile și limitele documentate."
              }
            </T>
          </p>
          <div className="marketing-actions">
            <Link
              className="marketing-button is-primary"
              href={authenticated ? "/dashboard" : "/register"}
            >
              <T>
                {authenticated
                  ? "Deschide platforma"
                  : "Începe testarea gratuită"}
              </T>{" "}
              →
            </Link>
            <Link className="marketing-button is-secondary" href="/prezentare">
              <T>{"Vezi demonstrația"}</T>
            </Link>
          </div>
        </section>
      </main>
      <MarketingFooter
        authenticated={authenticated}
        supportEmail={supportEmail}
      />
    </div>
  );
}
