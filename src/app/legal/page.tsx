import { T } from "@/components/locale-provider";
import Link from "next/link";
import { legalDocuments, legalPublication } from "@/features/legal/content";
import { LegalNotice } from "@/features/legal/legal-document";

export const metadata = { title: "Documente și informații" };
export default function LegalIndex() {
  return <main className="standalone legal-page">
    <Link className="text-link" href="/"><T>{"Voxa-OS · Pagina principală"}</T></Link>
    <header className="legal-heading"><p className="eyebrow"><T>{"TRANSPARENȚĂ"}</T></p><h1><T>{"Documente și informații"}</T></h1><p className="muted"><T>{"Condițiile propuse, datele personale și contactele relevante pentru Voxa-OS."}</T></p></header>
    <LegalNotice/>
    <div className="legal-document-grid">{legalDocuments.map(document => <Link className="legal-document-card" key={document.slug} href={`/legal/${document.slug}`}><h2><T>{document.title}</T></h2><p><T>{document.summary}</T></p><span><T>{"Citește proiectul →"}</T></span></Link>)}</div>
    <footer className="legal-document-footer"><p><T>{"Contact operațional: "}</T><a className="text-link" href={`mailto:${legalPublication.contact}`}>{legalPublication.contact}</a></p><Link className="text-link" href="/help"><T>{"Ajutor și suport"}</T></Link></footer>
  </main>;
}
