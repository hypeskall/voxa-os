import Link from "next/link";
import { legalDocuments, legalPublication } from "@/features/legal/content";
import { LegalNotice } from "@/features/legal/legal-document";

export const metadata = { title: "Documente și informații" };
export default function LegalIndex() {
  return <main className="standalone legal-page">
    <Link className="text-link" href="/">Voxa-OS · Pagina principală</Link>
    <header className="legal-heading"><p className="eyebrow">TRANSPARENȚĂ</p><h1>Documente și informații</h1><p className="muted">Condițiile propuse, datele personale și contactele relevante pentru Voxa-OS.</p></header>
    <LegalNotice/>
    <div className="legal-document-grid">{legalDocuments.map(document => <Link className="legal-document-card" key={document.slug} href={`/legal/${document.slug}`}><h2>{document.title}</h2><p>{document.summary}</p><span>Citește proiectul →</span></Link>)}</div>
    <footer className="legal-document-footer"><p>Contact operațional: <a className="text-link" href={`mailto:${legalPublication.contact}`}>{legalPublication.contact}</a></p><Link className="text-link" href="/help">Ajutor și suport</Link></footer>
  </main>;
}
