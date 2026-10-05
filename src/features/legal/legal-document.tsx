import { T, LocalizedElement } from "@/components/locale-provider";
import Link from "next/link";
import { legalDocuments, legalPublication, type LegalDocument } from "./content";

export function LegalNotice() {
  return <LocalizedElement as="aside" className="legal-notice" aria-label="Statutul documentelor">
    <strong><T>{"Proiect pentru revizuire"}</T></strong>
    <p><T>{legalPublication.notice}</T></p>
    <small><T>{"Actualizat: "}</T>{legalPublication.updated}<T>{" · Versiune: "}</T>{legalPublication.version}</small>
  </LocalizedElement>;
}

export function LegalNavigation() {
  return <LocalizedElement as="nav" className="legal-nav" aria-label="Documente și informații">
    <Link href="/legal"><T>{"Toate documentele"}</T></Link>
    {legalDocuments.map(document => <Link key={document.slug} href={`/legal/${document.slug}`}><T>{document.title}</T></Link>)}
  </LocalizedElement>;
}

export function LegalDocumentView({ document }: { document: LegalDocument }) {
  return <main className="standalone legal-page">
    <Link className="text-link" href="/"><T>{"Voxa-OS · Pagina principală"}</T></Link>
    <header className="legal-heading"><p className="eyebrow"><T>{"VOXA-OS · DOCUMENTE"}</T></p><h1><T>{document.title}</T></h1><p className="muted"><T>{document.summary}</T></p></header>
    <LegalNotice/>
    <LegalNavigation/>
    <LocalizedElement as="nav" className="legal-contents" aria-label="Cuprins">
      <strong><T>{"Pe această pagină"}</T></strong>
      <ol>{document.sections.map(section => <li key={section.id}><a href={`#${section.id}`}><T>{section.title}</T></a></li>)}</ol>
    </LocalizedElement>
    <article>{document.sections.map(section => <section className="legal-section" key={section.id} id={section.id}>
      <h2><T>{section.title}</T></h2>
      {section.paragraphs.map(paragraph => <p key={paragraph}><T>{paragraph}</T></p>)}
      {section.items && <ul>{section.items.map(item => <li key={item}><T>{item}</T></li>)}</ul>}
      {section.table && <LocalizedElement as="div" className="legal-table-scroll" tabIndex={0} role="region" aria-label={`Tabel: ${section.title}`}>
        <table><caption><T>{section.title}</T></caption><thead><tr>{section.table.columns.map(column => <th scope="col" key={column}><T>{column}</T></th>)}</tr></thead>
          <tbody>{section.table.rows.map(row => <tr key={row[0]}>{row.map((cell, index) => index === 0 ? <th scope="row" key={index}><T>{cell}</T></th> : <td key={index}><T>{cell}</T></td>)}</tr>)}</tbody>
        </table>
      </LocalizedElement>}
    </section>)}</article>
    <section className="legal-section"><h2><T>{"Surse oficiale și informații suplimentare"}</T></h2><ul>{document.sources.map(source => <li key={source.url}><a className="text-link" href={source.url} target="_blank" rel="noopener noreferrer"><T>{source.label}</T></a></li>)}</ul></section>
    <footer className="legal-document-footer"><p><T>{"Contact operațional: "}</T><a className="text-link" href={`mailto:${legalPublication.contact}`}>{legalPublication.contact}</a></p><Link className="text-link" href="/legal"><T>{"Înapoi la toate documentele"}</T></Link></footer>
  </main>;
}
