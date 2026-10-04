"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/features/auth/actions";
import { requireClinic } from "@/features/auth/access";

export async function saveNotificationSettings(cid: string, _: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireClinic(cid, "notifications.manage");
  const parsed = z.object({ confirmation_expiry_hours: z.coerce.number().int().min(1).max(720), cancellation_min_notice_hours: z.coerce.number().int().min(0).max(720) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Verificați intervalele configurate." };
  const offsets = [2880, 1440, 120].filter(value => form.getAll("reminders").includes(String(value)));
  if (form.get("sms_enabled") === "on" && process.env.NOTIFICATION_PROVIDER !== "webhook")
    return { error: "Canalul SMS nu este configurat. Folosiți emailul." };
  const { error } = await client.rpc("save_notification_settings", { cid, payload: { ...parsed.data, sms_enabled: form.get("sms_enabled") === "on", email_enabled: form.get("email_enabled") === "on", reminder_offsets_minutes: offsets } });
  if (error) return { error: "Setările nu au putut fi salvate." };
  revalidatePath(`/clinics/${cid}/notifications`);
  return { success: "Setările de comunicare au fost salvate." };
}

export async function saveTemplate(cid: string, templateId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireClinic(cid, "notifications.manage");
  const parsed = z.object({ subject: z.string().max(200), body: z.string().trim().min(1).max(4000) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Verificați subiectul și conținutul mesajului." };
  const { error } = await client.rpc("save_communication_template", { cid, template_id: templateId, template_subject: parsed.data.subject, template_body: parsed.data.body, is_active: form.get("active") === "on" });
  if (error) return { error: "Șablonul nu a putut fi salvat." };
  revalidatePath(`/clinics/${cid}/notifications`);
  return { success: "Șablonul a fost actualizat." };
}
