import content from "./documents.json";

type LegalSection = {
  id: string;
  title: string;
  paragraphs: string[];
  items?: string[];
  table?: { columns: string[]; rows: string[][] };
};
export type LegalDocument = {
  slug: string;
  title: string;
  summary: string;
  sections: LegalSection[];
  sources: { label: string; url: string }[];
};
export const legalDocuments: LegalDocument[] = content.documents;
export const legalPublication = {
  version: content.version,
  updated: content.updated,
  status: content.status,
  notice: content.notice,
  contact: content.contact,
};
export function legalDocument(slug: string) {
  return legalDocuments.find(document => document.slug === slug);
}
