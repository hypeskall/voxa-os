import Link from "next/link";
import { legalDocuments, legalPublication, type LegalDocument } from "./content";

export function LegalNotice() {
  return <aside className="legal-notice" aria-label="Statutul documentelor">
    <strong>Proiect pentru revizuire</strong>
    <p>{legalPublication.notice}</p>
    <small>Actualizat: {legalPublication.updated} · Versiune: {legalPublication.version}</small>
  </aside>;
}

export function LegalNavigation() {
  return <nav className="legal-nav" aria-label="Documente și informații">
    <Link href="/legal">Toate documentele</Link>
    {legalDocuments.map(document => <Link key={document.slug} href={`/legal/${document.slug}`}>{document.title}</Link>)}
  </nav>;
}

export function LegalDocumentView({ document }: { document: LegalDocument }) {
  return <main className="standalone legal-page">
    <Link className="text-link" href="/">Voxa-OS · Pagina principală</Link>
    <header className="legal-heading"><p className="eyebrow">VOXA-OS · DOCUMENTE</p><h1>{document.title}</h1><p className="muted">{document.summary}</p></header>
    <LegalNotice/>
    <LegalNavigation/>
    <nav className="legal-contents" aria-label="Cuprins">
      <strong>Pe această pagină</strong>
      <ol>{document.sections.map(section => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ol>
    </nav>
    <article>{document.sections.map(section => <section className="legal-section" key={section.id} id={section.id}>
      <h2>{section.title}</h2>
      {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
      {section.items && <ul>{section.items.map(item => <li key={item}>{item}</li>)}</ul>}
      {section.table && <div className="legal-table-scroll" tabIndex={0} role="region" aria-label={`Tabel: ${section.title}`}>
        <table><caption>{section.title}</caption><thead><tr>{section.table.columns.map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead>
          <tbody>{section.table.rows.map(row => <tr key={row[0]}>{row.map((cell, index) => index === 0 ? <th scope="row" key={index}>{cell}</th> : <td key={index}>{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>}
    </section>)}</article>
    <section className="legal-section"><h2>Surse oficiale și informații suplimentare</h2><ul>{document.sources.map(source => <li key={source.url}><a className="text-link" href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a></li>)}</ul></section>
    <footer className="legal-document-footer"><p>Contact operațional: <a className="text-link" href={`mailto:${legalPublication.contact}`}>{legalPublication.contact}</a></p><Link className="text-link" href="/legal">Înapoi la toate documentele</Link></footer>
  </main>;
}
