"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/features/auth/actions";
import { requireClinic } from "@/features/auth/access";
import { validateMedicalFile, type MedicalMime } from "@/lib/file-validation";

const allowed: MedicalMime[] = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
export async function uploadPatientDocument(cid: string, pid: string, _: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireClinic(cid, "documents.manage");
  const parsed = z.object({ title: z.string().trim().min(2).max(200), document_type_id: z.uuid(), appointment_id: z.union([z.uuid(), z.literal("")]).default("") }).safeParse(Object.fromEntries(form));
  const file = form.get("file");
  if (!parsed.success || !(file instanceof File)) return { error: "Selectați un PDF sau o imagine de cel mult 20 MB și completați datele." };
  const mime=await validateMedicalFile(file,allowed,20*1024*1024);
  if(!mime)return {error:"Conținutul fișierului nu corespunde unui PDF, PNG, JPEG sau WebP valid de cel mult 20 MB."};
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
  const path = `${cid}/${pid}/documents/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await client.storage.from("voxa-medical").upload(path, file, { contentType: mime, upsert: false });
  if (uploadError) return { error: "Fișierul nu a putut fi încărcat." };
  const { error } = await client.rpc("save_patient_document", { cid, pid, aid: parsed.data.appointment_id || null, type_id: parsed.data.document_type_id, document_title: parsed.data.title, path, file_label: file.name, mime, bytes: file.size, patient_visible: form.get("visible_to_patient") === "on" });
  if (error) { await client.storage.from("voxa-medical").remove([path]); return { error: "Documentul nu a putut fi înregistrat." }; }
  revalidatePath(`/clinics/${cid}/patients/${pid}`);
  return { success: "Documentul a fost încărcat în spațiul privat." };
}
