"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireClinic } from "@/features/auth/access";
import { can } from "@/lib/permissions";
import type { ActionState } from "@/features/auth/actions";
export async function addNote(cid: string, pid: string, _: ActionState, form: FormData): Promise<ActionState> {
  const { client, permissions } = await requireClinic(cid);
  const content = z.string().trim().min(1).max(10000).safeParse(form.get("content"));
  if (!content.success || !z.uuid().safeParse(pid).success) return { error: "Completați nota (maximum 10.000 de caractere)." };
  if (!can(permissions, "patients.manage") && !can(permissions, "results.manage")) return { error: "Nu aveți acces la modificarea notelor." };
  const { error } = await client.rpc("add_patient_note", { cid, pid, note_content: content.data });
  if (error) return { error: "Nota nu a putut fi salvată. Verificați accesul la pacient." };
  revalidatePath(`/clinics/${cid}/patients/${pid}`);
  revalidatePath(`/clinics/${cid}/clinical-patients/${pid}`);
  return { success: "Nota a fost salvată." };
}
export async function requestPrivacy(cid: string, pid: string, _: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireClinic(cid, "organization.manage");
  const input = z.object({ kind: z.enum(["anonymization", "erasure"]), reason: z.string().trim().min(10).max(2000) }).safeParse(Object.fromEntries(form));
  if (!input.success || !z.uuid().safeParse(pid).success) return { error: "Selectați tipul solicitării și completați motivul (10–2.000 de caractere)." };
  const { error } = await client.rpc("request_patient_privacy", { cid, pid, kind: input.data.kind, reason_value: input.data.reason });
  if (error) return { error: "Solicitarea nu a putut fi înregistrată." };
  revalidatePath(`/clinics/${cid}/settings/privacy`);
  return { success: "Solicitarea a fost înregistrată pentru analiză. Datele nu au fost șterse." };
}
export async function reviewPrivacy(cid: string, rid: string, _: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireClinic(cid, "organization.manage");
  const input = z.object({ decision: z.enum(["approved", "rejected", "completed"]), review: z.string().trim().min(10).max(2000) }).safeParse(Object.fromEntries(form));
  if (!input.success || !z.uuid().safeParse(rid).success) return { error: "Completați decizia și justificarea." };
  const { error } = await client.rpc("review_privacy_request", { cid, rid, decision: input.data.decision, review: input.data.review });
  if (error) return { error: "Decizia nu a putut fi salvată. Verificați starea solicitării." };
  revalidatePath(`/clinics/${cid}/settings/privacy`);
  return { success: "Decizia a fost înregistrată." };
}
