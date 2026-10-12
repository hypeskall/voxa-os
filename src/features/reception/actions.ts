"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireClinic } from "@/features/auth/access";
import type { ActionState } from "@/features/auth/actions";
import { localToInstant } from "@/features/core-clinic/validation";

function refresh(cid: string) {
  revalidatePath(`/clinics/${cid}/tasks`);
  revalidatePath(`/clinics/${cid}/waitlist`);
  revalidatePath(`/clinics/${cid}/calendar`);
}
export async function saveWork(
  cid: string,
  id: string | null,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client, clinic } = await requireClinic(cid, "appointments.manage");
  const fields = Object.fromEntries(form);
  const parsed = z
    .object({
      kind: z.enum(["TASK", "WAITLIST"]),
      title: z.string().trim().min(2).max(160),
      notes: z.string().max(2000).default(""),
      status: z
        .enum(["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"])
        .default("OPEN"),
      assigned_to: z.union([z.uuid(), z.literal("")]).default(""),
      patient_id: z.union([z.uuid(), z.literal("")]).default(""),
      service_id: z.union([z.uuid(), z.literal("")]).default(""),
      doctor_id: z.union([z.uuid(), z.literal("")]).default(""),
      appointment_id: z.union([z.uuid(), z.literal("")]).default(""),
    })
    .safeParse(fields);
  if (!parsed.success) return { error: "Verificați câmpurile formularului." };
  try {
    const dates = Object.fromEntries(
      ["due_at", "preferred_from", "preferred_to"].map((key) => [
        key,
        fields[key]
          ? localToInstant(String(fields[key]), clinic.timezone)
          : null,
      ]),
    );
    const { error } = await client.rpc("save_reception_work", {
      cid,
      work_id: id,
      payload: { ...parsed.data, ...dates },
      expected_updated_at: String(fields.version ?? "") || null,
    });
    if (error)
      return {
        error:
          "Modificarea nu a putut fi salvată. Verificați datele sau reîncărcați lista dacă a fost modificată de un coleg.",
      };
    refresh(cid);
    return { success: "Modificările au fost salvate." };
  } catch {
    return { error: "Verificați datele și orele introduse." };
  }
}
export async function offerSlot(
  cid: string,
  id: string,
  version: string,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client } = await requireClinic(cid, "appointments.manage");
  const start = z.iso
    .datetime({ offset: true })
    .safeParse(form.get("start_at"));
  if (!start.success) return { error: "Alegeți un interval disponibil." };
  const { data, error } = await client.rpc("offer_waitlist_slot", {
    cid,
    work_id: id,
    slot_start: start.data,
    expected_updated_at: version,
  });
  if (
    error ||
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    !data.ok
  )
    return {
      error:
        "Intervalul nu mai este disponibil sau cererea s-a modificat. Reîncărcați lista.",
    };
  refresh(cid);
  return {
    success:
      "Interval propus. Contactați pacientul pentru acceptare; intervalul nu este rezervat.",
  };
}
export async function bookOffer(
  cid: string,
  id: string,
  version: string,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client } = await requireClinic(cid, "appointments.manage");
  if (form.get("accepted") !== "on")
    return { error: "Confirmați că pacientul a acceptat intervalul." };
  const { data, error } = await client.rpc("book_waitlist_slot", {
    cid,
    work_id: id,
    expected_updated_at: version,
  });
  if (
    error ||
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    !data.ok
  )
    return {
      error:
        "Oferta a expirat sau intervalul a fost ocupat. Propuneți un alt interval.",
    };
  refresh(cid);
  return { success: "Programarea a fost creată." };
}
