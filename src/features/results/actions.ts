"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/features/auth/actions";
import { requireClinic } from "@/features/auth/access";
import { medicalResult } from "./data";
import { resultPdf } from "./pdf";
import { cleanupUploads } from "@/lib/storage-cleanup";

export async function saveResult(cid: string, resultId: string | null, _: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireClinic(cid, "results.manage");
  const parsed = z.object({ appointment_id: z.uuid(), doctor_id: z.uuid(), title: z.string().trim().min(2).max(200), content: z.string().trim().min(1).max(100000), version: z.coerce.number().int().positive().optional(), change_reason: z.string().max(1000).default("") }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Completați titlul și conținutul rezultatului." };
  const { data, error } = await client.rpc("save_medical_result", { cid, result_id: resultId, aid: parsed.data.appointment_id, did: parsed.data.doctor_id, result_title: parsed.data.title, result_content: parsed.data.content, expected_version: parsed.data.version ?? null, change_reason: parsed.data.change_reason });
  if (error || !data) return { error: "Rezultatul nu a putut fi salvat. Verificați asocierea medicului și versiunea." };
  revalidatePath(`/clinics/${cid}/results`); redirect(`/clinics/${cid}/results/${data}`);
}
export async function validateResult(cid: string, id: string, state: ActionState, form: FormData): Promise<ActionState> {
  void state; void form;
  const { client } = await requireClinic(cid, "results.release");
  const { error } = await client.rpc("transition_medical_result", { cid, result_id: id, next_status: "VALIDATED", pdf_path: null });
  if (error) return { error: "Rezultatul nu a putut fi validat." };
  revalidatePath(`/clinics/${cid}/results/${id}`); return { success: "Rezultatul a fost validat și blocat pentru editare." };
}
export async function releaseResult(cid: string, id: string, state: ActionState, form: FormData): Promise<ActionState> {
  void state; void form;
  const { client } = await requireClinic(cid, "results.release");
  const result = await medicalResult(cid, id);
  if (result.status !== "VALIDATED") return { error: "Doar un rezultat validat poate fi publicat." };
  const { data: credentialRaw } = await client.rpc("read_doctor_credentials", { cid, did: result.doctor_location_id });
  const credential = z.object({ signature_object_path: z.string().nullable().optional(), signature_mime: z.string().nullable().optional(), stamp_object_path: z.string().nullable().optional(), stamp_mime: z.string().nullable().optional() }).parse(credentialRaw);
  async function image(path?: string | null, mime?: string | null) { if (!path || !mime) return null; const { data } = await client.storage.from("voxa-medical").download(path); return data ? { bytes: await data.arrayBuffer(), mime } : null; }
  const bytes = await resultPdf(result, await image(credential.signature_object_path, credential.signature_mime), await image(credential.stamp_object_path, credential.stamp_mime));
  const path = `${cid}/${result.patient_id}/results/${id}/v${result.version + 1}.pdf`;
  const { error: uploadError } = await client.storage.from("voxa-medical").upload(path, bytes, { contentType: "application/pdf", upsert: false });
  if (uploadError) { const cleanup = await cleanupUploads(client, "voxa-medical", [path]); return { error: "PDF-ul nu a putut fi stocat în siguranță." + cleanup }; }
  const { error } = await client.rpc("transition_medical_result", { cid, result_id: id, next_status: "RELEASED", pdf_path: path });
  if (error) { const cleanup = await cleanupUploads(client, "voxa-medical", [path]); return { error: "Rezultatul nu a putut fi publicat." + cleanup }; }
  revalidatePath(`/clinics/${cid}/results/${id}`); return { success: "Rezultatul a fost publicat în portalul pacientului." };
}
