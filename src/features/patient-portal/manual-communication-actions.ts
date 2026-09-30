"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireClinic } from "@/features/auth/access";
import type { ActionState } from "@/features/auth/actions";

export async function recordManualCommunication(cid: string, pid: string, _: ActionState, form: FormData): Promise<ActionState> {
  const input=z.object({channel:z.enum(["PHONE","WHATSAPP","EMAIL","SMS","IN_PERSON","OTHER"]),direction:z.enum(["OUTBOUND","INBOUND"]),summary:z.string().trim().min(2).max(1000)}).safeParse(Object.fromEntries(form));
  if(!input.success)return{error:"Completați canalul, direcția și un rezumat scurt."};
  const {client}=await requireClinic(cid,"patients.manage");
  const {error}=await client.rpc("record_patient_communication",{cid,pid,channel_value:input.data.channel,direction_value:input.data.direction,summary_value:input.data.summary,occurred:null});
  if(error)return{error:"Comunicarea nu a putut fi înregistrată."};
  revalidatePath(`/clinics/${cid}/patients/${pid}`);
  return{success:"Comunicarea a fost înregistrată."};
}
