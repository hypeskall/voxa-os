"use server";
import { revalidatePath } from "next/cache";
import { requireClinic } from "@/features/auth/access";
import type { ActionState } from "@/features/auth/actions";
import { importRows, importReport } from "./model";
export async function commitImport(
  cid: string,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client } = await requireClinic(cid, "patients.manage");
  if (form.get("confirmed") !== "on")
    return { error: "Confirmați importul după verificarea previzualizării." };
  let records;
  try {
    const raw = form.get("records");
    if (typeof raw !== "string" || raw.length > 1_000_000) throw new Error();
    records = importRows.parse(JSON.parse(raw));
  } catch {
    return { error: "Datele importului nu sunt valide. Reîncărcați fișierul." };
  }
  const { data, error } = await client.rpc("import_patients", {
    cid,
    records,
    preview_only: false,
  });
  if (error)
    return {
      error:
        "Importul nu a putut fi finalizat. Nicio înregistrare din această încercare nu a fost adăugată.",
    };
  const report = importReport.parse(data);
  revalidatePath(`/clinics/${cid}/patients`);
  return {
    success: `Import finalizat: ${report.created} pacienți adăugați, ${report.skipped} duplicate omise.`,
  };
}
