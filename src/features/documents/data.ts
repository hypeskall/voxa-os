import "server-only";
import { z } from "zod";
import { requireClinic } from "@/features/auth/access";
import { documentSchema } from "./model";
export async function patientDocuments(cid: string, pid: string) {
  const { client } = await requireClinic(cid, "documents.read");
  const [{ data, error }, { data: types }] = await Promise.all([
    client.rpc("list_patient_documents", { cid, pid }),
    client.from("document_types").select("id,name").eq("clinic_id", cid).eq("active", true).order("name"),
  ]);
  if (error) throw new Error("Documentele nu au putut fi încărcate.");
  return { documents: z.array(documentSchema).parse(data), types: types ?? [] };
}
