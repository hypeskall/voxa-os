import "server-only";
import { z } from "zod";
import { adminDb } from "@/lib/supabase/admin";
import { confirmationToken } from "@/features/confirmations/token";
import { notificationProvider } from "./provider";

const jobSchema = z.object({ id: z.uuid(), event: z.string(), channel: z.enum(["SMS", "EMAIL"]), recipient: z.string(), idempotency_key: z.string() });
const contextSchema = z.object({ clinic_name: z.string(), clinic_address: z.string(), clinic_phone: z.string(), timezone: z.string(), patient_name: z.string(), service_name: z.string().nullable(), start_at: z.string().nullable(), template_subject: z.string().nullable(), template_body: z.string().nullable(), confirmation_public_id: z.string().nullable(), confirmation_expires_at: z.string().nullable() });

function render(template: string, values: Record<string, string>) {
  return template.replace(/{{([a-z_]+)}}/g, (_, key: string) => values[key] ?? "");
}
export async function processNotifications(origin: string) {
  const client = adminDb();
  await client.rpc("enqueue_due_reminders", { reference_time: new Date().toISOString() });
  const { data, error } = await client.rpc("claim_notification_jobs", { batch_size: 25 });
  if (error) throw error;
  const jobs = z.array(jobSchema).parse(data);
  let sent = 0;
  for (const job of jobs) {
    try {
      const { data: rawContext, error: contextError } = await client.rpc("notification_job_context", { job_id: job.id });
      if (contextError) throw contextError;
      const context = contextSchema.parse(rawContext);
      const start = context.start_at ? new Date(context.start_at) : null;
      const confirmation = context.confirmation_public_id && context.confirmation_expires_at ? confirmationToken(context.confirmation_public_id, context.confirmation_expires_at) : "";
      const values = { clinic_name: context.clinic_name, clinic_address: context.clinic_address, clinic_phone: context.clinic_phone, patient_name: context.patient_name, service_name: context.service_name ?? "", date: start ? new Intl.DateTimeFormat("ro-RO", { dateStyle: "long", timeZone: context.timezone }).format(start) : "", time: start ? new Intl.DateTimeFormat("ro-RO", { timeStyle: "short", timeZone: context.timezone }).format(start) : "", confirmation_url: confirmation ? `${origin}/appointment/${confirmation}` : "", portal_url: `${origin}/portal` };
      const delivery = await notificationProvider().send({ channel: job.channel, recipient: job.recipient, subject: render(context.template_subject ?? "Voxa OS", values), body: render(context.template_body ?? "Aveți o actualizare disponibilă.", values), idempotencyKey: job.idempotency_key });
      await client.rpc("finish_notification_job", { job_id: job.id, final_status: delivery.status, provider_id: delivery.providerMessageId, error_text: "" });
      sent++;
    } catch (error) {
      const safe = error instanceof Error ? error.message.replace(/[\w.+-]+@[\w.-]+|\+?\d[\d\s-]{6,}/g, "[redactat]").slice(0, 500) : "Eroare furnizor";
      await client.rpc("finish_notification_job", { job_id: job.id, final_status: "FAILED", provider_id: "", error_text: safe });
    }
  }
  return { claimed: jobs.length, sent };
}
