import { notFound } from "next/navigation";
import { legalDocument } from "@/features/legal/content";
import { LegalDocumentView } from "@/features/legal/legal-document";

type Props = { params: Promise<{ document: string }> };
export async function generateMetadata({ params }: Props) {
  const { document } = await params;
  const content = legalDocument(document);
  if (!content) notFound();
  return { title: content.title, description: content.summary };
}
export default async function LegalPage({ params }: Props) {
  const { document } = await params;
  const content = legalDocument(document);
  if (!content) notFound();
  return <LegalDocumentView document={content}/>;
}
