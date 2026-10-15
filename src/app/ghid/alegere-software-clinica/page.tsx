import Link from "next/link";
import { marketingMetadata, MarketingSchema } from "@/features/marketing/seo";
import { marketingContext } from "@/features/marketing/render-page";
import { MarketingHeader } from "@/features/marketing/marketing-header";
import { MarketingFooter } from "@/features/marketing/marketing-footer";
import { PrelaunchNotice } from "@/features/marketing/prelaunch-notice";

export const generateMetadata = () => marketingMetadata("alegere-software-clinica");

const criteria = [
  ["cerinte", "Definește cerințele clinicii", "Scrie numărul de medici, locații și persoane de la recepție. Separă cerințele obligatorii de funcțiile ocazionale. Dacă ai nevoie de CNAS/SIUI, rețete electronice, casă de marcat sau e-Factura, cere o demonstrație pentru fiecare cerință. Denumirea «software medical» nu dovedește că sunt incluse."],
  ["programari", "Testează programările în software-ul clinicii", "Creează un pacient fictiv, alege serviciul, medicul și locația. Verifică disponibilitatea și suprapunerea programărilor. Mută ora, schimbă medicul și anulează programarea. Urmărește ce vede recepția și ce vede medicul. Dacă există rezervare online, verifică apariția ei în calendar."],
  ["import", "Verifică registrul de pacienți și importul", "Cere un fișier-model. Pregătește un rând corect, un duplicat și un rând cu date lipsă, toate fictive. Verifică erorile înainte de confirmare și regulile pentru duplicate. Întreabă ce se mută: date administrative, programări, documente sau istoric. Confirmă formatele, câmpurile și limita de rânduri."],
  ["acces", "Verifică accesul echipei și portalul", "Folosește conturi distincte pentru administrator, recepție și medic. Testează ce poate vedea și modifica fiecare rol. Verifică retragerea accesului unui coleg și autentificarea în doi pași. În portalul pacientului, verifică ce apare după partajarea explicită a unui document."],
  ["integrari", "Clarifică mesajele și integrările", "Pentru email, SMS și WhatsApp, întreabă dacă trimiterea este automată sau manuală, cine este furnizorul și ce costuri externe există. Cere o demonstrație a funcției disponibile acum. Un logo Stripe nu dovedește că poți încasa consultațiile clinicii prin produs."],
  ["cost", "Calculează costul software-ului pentru clinică", "Compară prețul per organizație, medic, cabinet sau utilizator. Include mesajele, stocarea, implementarea, importul, instruirea și suportul, dacă se plătesc separat. Confirmă moneda și TVA-ul. Pentru testare, verifică durata, necesitatea cardului și ce se întâmplă la final. Citește condițiile de anulare și accesul la date după încetare."],
  ["export", "Verifică furnizorul și exportul", "Înainte de folosirea cu date reale, verifică identitatea furnizorului, contractele și responsabilitățile privind datele. Cere explicații despre serviciile terțe, suport și recuperare. Testează un export fictiv: ce fișiere obții, dacă documentele originale se descarcă separat și dacă formatul permite mutarea datelor."],
] as const;

export default async function Page() {
  const { authenticated, supportEmail } = await marketingContext();
  return <div className="marketing-page marketing-subpage">
    <MarketingSchema page="alegere-software-clinica" />
    <a href="#marketing-main" className="skip-link">Sari la conținut</a>
    <MarketingHeader authenticated={authenticated} />
    <main id="marketing-main" className="marketing-container marketing-resource">
      <article lang="ro">
        <div className="marketing-page-intro">
          <Link href="/" className="marketing-text-link">Pagina principală →</Link>
          <h1>Cum alegi un software pentru clinică</h1>
          <p>Material redactat pentru Voxa-OS · <time dateTime="2026-10-09">9 octombrie 2026</time></p>
        </div>
        <p className="resource-lead">Ca să alegi un software pentru clinică, testează un circuit complet cu date fictive: programarea, profilul pacientului, accesul echipei și documentele partajate. Compară costul total și verifică importul, exportul și condițiile furnizorului. Notează separat ce ai văzut funcționând în demonstrație și ce a rămas doar o promisiune.</p>
        <nav aria-label="Cuprinsul ghidului" className="resource-section">
          <h2>Ce verifici înainte să alegi</h2>
          <ol>{criteria.map(([id, title]) => <li key={id}><a href={`#${id}`}>{title}</a></li>)}</ol>
          <a href="/templates/evaluare-software-clinica.csv" download>Descarcă fișa de evaluare CSV ↓</a>
        </nav>
        {criteria.map(([id, title, text], index) => <section id={id} className="resource-section" key={id}>
          <h2>{index + 1}. {title}</h2><p>{text}</p>
          {id === "programari" && <Link href="/prezentare">Vezi demonstrația calendarului Voxa-OS →</Link>}
          {id === "import" && <Link href="/migrare">Consultă formatele și limitele importului Voxa-OS →</Link>}
          {id === "acces" && <Link href="/securitate">Vezi rolurile și protecția documentelor →</Link>}
          {id === "integrari" && <Link href="/integrari">Verifică rolul fiecărui serviciu în Voxa-OS →</Link>}
          {id === "cost" && <Link href="/pret">Consultă prețul și condițiile testării Voxa-OS →</Link>}
        </section>)}
        <section className="resource-section">
          <h2>Ce greșeli poți evita la evaluare?</h2>
          <p>Nu bifa o cerință doar pentru că apare în lista de funcții. Cere să o vezi cu rolul care o va folosi. Păstrează separat funcțiile disponibile de cele planificate și verifică un export înainte să te bazezi pe posibilitatea de migrare.</p>
          <h2>Poți testa cu pacienți reali?</h2>
          <p>Pentru demonstrație, folosește pacienți fictivi. Introducerea datelor reale trebuie precedată de clarificarea contractelor, responsabilităților și condițiilor de utilizare ale mediului ales.</p>
          <h2>Ce poți evalua în Voxa-OS?</h2>
          <PrelaunchNotice />
          <p>Poți examina calendarul, programările și profilul pacientului în prezentarea publică. Importul CSV/XLSX transferă registrul administrativ, cu maximum 500 de rânduri per fișier. Voxa-OS nu oferă raportare CNAS/SIUI sau rețete electronice. WhatsApp este manual.</p>
          <p>Ghidul ajută evaluarea operațională; nu certifică un produs sau conformitatea sa.</p>
          <div className="marketing-actions"><Link href="/prezentare" className="marketing-button is-primary">Vezi demonstrația cu date fictive →</Link><Link href="/functionalitati" className="marketing-button is-secondary">Verifică funcțiile disponibile</Link></div>
        </section>
      </article>
    </main>
    <MarketingFooter authenticated={authenticated} supportEmail={supportEmail} />
  </div>;
}
