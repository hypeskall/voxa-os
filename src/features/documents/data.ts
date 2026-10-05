import "server-only";
import { z } from "zod";
import { requireClinic } from "@/features/auth/access";
import { documentSchema } from "./model";
export async function patientDocuments(cid: string, pid: string) {
  const { client } = await requireClinic(cid, "documents.read");
  const [{ data, error }, { data: types, error: typeError }] = await Promise.all([
    client.rpc("list_patient_documents", { cid, pid }),
    client.from("document_types").select("id,name").eq("clinic_id", cid).eq("active", true).order("name"),
  ]);
  if (error || typeError) throw new Error("Documentele nu au putut fi încărcate.");
  return { documents: z.array(documentSchema).parse(data), types: types ?? [] };
}
export async function patientResultUploads(cid: string, pid: string) {
  const { client } = await requireClinic(cid, "documents.read");
  const { data, error } = await client.rpc("list_patient_result_uploads", { cid, pid });
  if (error) throw new Error("Rezultatele încărcate nu au putut fi citite.");
  return z.array(documentSchema).parse(data);
}
