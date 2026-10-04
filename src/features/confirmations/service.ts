import "server-only";
import { z } from "zod";
import { requireClinic } from "@/features/auth/access";
import { adminDb } from "@/lib/supabase/admin";
import { createConfirmationMaterial } from "./token";

export async function issueConfirmation(clinicId: string, appointmentId: string) {
  const { client } = await requireClinic(clinicId, "appointments.manage");
  const { data: settings } = await client.from("clinic_notification_settings").select("confirmation_expiry_hours").eq("clinic_id", clinicId).single();
  const material = createConfirmationMaterial(settings?.confirmation_expiry_hours ?? 168);
  const { error } = await client.rpc("issue_appointment_confirmation", {
    cid: clinicId, aid: z.uuid().parse(appointmentId), token_digest: material.digest,
    token_public_id: material.publicId, expires: material.expiresAt,
  });
  if (error) throw new Error("Confirmarea programării nu a putut fi pregătită.");
  return material;
}

export async function issueSystemConfirmation(clinicSlug: string, appointmentId: string) {
  const client = adminDb();
  const { data: clinic, error: clinicError } = await client.from("clinics").select("id").eq("booking_slug", clinicSlug).single();
  if (clinicError || !clinic) throw new Error("Clinica nu este disponibilă.");
  const clinicId = clinic.id;
  const { data: settings } = await client.from("clinic_notification_settings").select("confirmation_expiry_hours").eq("clinic_id", clinicId).single();
  const material = createConfirmationMaterial(settings?.confirmation_expiry_hours ?? 168);
  const { error } = await client.rpc("issue_system_confirmation", {
    cid: clinicId, aid: appointmentId, token_digest: material.digest,
    token_public_id: material.publicId, expires: material.expiresAt,
  });
  if (error) throw new Error("Confirmarea programării nu a putut fi pregătită.");
  return material;
}
