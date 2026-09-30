"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireClinic } from "@/features/auth/access";
import type { ActionState } from "@/features/auth/actions";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export async function saveClinicScheduleAction(
  cid: string,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const rows = Array.from({ length: 7 }, (_, index) => {
    const weekday = index + 1;
    const closed = form.get(`day_${weekday}_open`) !== "on";
    return {
      weekday,
      closed,
      start_time: String(form.get(`day_${weekday}_start`) ?? "08:00"),
      end_time: String(form.get(`day_${weekday}_end`) ?? "20:00"),
    };
  });
  const schema = z.array(z.object({
    weekday: z.number().int().min(1).max(7),
    closed: z.boolean(),
    start_time: time,
    end_time: time,
  }).refine((value) => value.closed || value.end_time > value.start_time, "Ora de sfârșit trebuie să fie după ora de început." )).length(7);
  const parsed = schema.safeParse(rows);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Program invalid." };
  const { client } = await requireClinic(cid, "availability.manage");
  const { error } = await client.rpc("save_clinic_weekly_schedule", { cid, payload: parsed.data });
  if (error) return { error: error.code === "42501" ? "Nu aveți permisiunea de a modifica programul." : "Programul clinicii nu a putut fi salvat." };
  revalidatePath(`/clinics/${cid}/availability`);
  return { success: "Programul clinicii a fost actualizat." };
}
