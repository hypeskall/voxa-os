"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireClinic } from "@/features/auth/access";
import type { ActionState } from "@/features/auth/actions";
import { moduleSchema, modulePermission, type CoreModule } from "./model";
import { parseCore } from "./validation";
function databaseMessage(code: string | undefined, message: string) {
  if (code === "40001")
    return "Această înregistrare a fost modificată de alt utilizator. Reîncărcați pagina înainte de a salva.";
  if (code === "23505")
    return "Numele sau identificatorul există deja. Verificați și înregistrările arhivate.";
  if (code === "23P01")
    return "Intervalul se suprapune cu un alt interval de același tip pentru aceeași resursă.";
  if (code === "23503" || message.includes("Resource"))
    return "O resursă nu este disponibilă în această clinică. Verificați selecțiile.";
  if (message.includes("all doctor locations"))
    return "Modificarea identității comune a medicului necesită drept de administrare în toate locațiile sale.";
  if (code === "42501")
    return "Nu aveți permisiunea de a efectua această modificare.";
  return "Datele nu au putut fi salvate. Verificați câmpurile și accesul la locație.";
}
export async function saveCoreAction(
  cid: string,
  rawModule: CoreModule,
  id: string | null,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const moduleKey = moduleSchema.parse(rawModule);
  const { client, clinic } = await requireClinic(
    cid,
    modulePermission(moduleKey, "manage"),
  );
  if (id && !z.uuid().safeParse(id).success)
    return { error: "Identificator invalid." };
  let payload;
  try {
    payload = parseCore(moduleKey, form, clinic.timezone);
  } catch (e) {
    return {
      error:
        e instanceof z.ZodError
          ? `Verificați formularul: ${e.issues[0]?.message ?? "date invalide"}`
          : e instanceof Error
            ? e.message
            : "Verificați formularul.",
    };
  }
  const version = z
    .union([z.iso.datetime({ offset: true }), z.literal("")])
    .safeParse(form.get("version") ?? "");
  if (!version.success)
    return { error: "Versiune invalidă. Reîncărcați pagina." };
  const args = {
    cid,
    entity_id: id,
    payload,
    expected_updated_at: version.data || null,
  };
  const { data, error } =
    moduleKey === "doctors"
      ? await client.rpc("save_doctor", args)
      : await client.rpc("save_core", { ...args, module: moduleKey });
  if (error) return { error: databaseMessage(error.code, error.message) };
  revalidatePath(`/clinics/${cid}/${moduleKey}`, "layout");
  // Relations may also be edited from the other side of the association.
  if (moduleKey === "doctors" || moduleKey === "services") {
    revalidatePath(`/clinics/${cid}/doctors`, "layout");
    revalidatePath(`/clinics/${cid}/services`, "layout");
  }
  redirect(`/clinics/${cid}/${moduleKey}/${data}`);
}
export async function archiveCoreAction(
  cid: string,
  moduleKey: CoreModule,
  id: string,
  restore: boolean,
  state: ActionState,
): Promise<ActionState> {
  void state;
  moduleSchema.parse(moduleKey);
  z.uuid().parse(id);
  const { client } = await requireClinic(
    cid,
    modulePermission(moduleKey, "manage"),
  );
  const { error } = await client.rpc("archive_core", {
    cid,
    module: moduleKey,
    entity_id: id,
    restore,
  });
  if (error) return { error: databaseMessage(error.code, error.message) };
  revalidatePath(`/clinics/${cid}/${moduleKey}`, "layout");
  redirect(
    restore
      ? `/clinics/${cid}/${moduleKey}/${id}`
      : `/clinics/${cid}/${moduleKey}`,
  );
}
export async function attachDoctorAction(
  cid: string,
  id: string,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const target = z.uuid().safeParse(form.get("target_clinic"));
  if (!target.success) return { error: "Selectați o locație." };
  const { client } = await requireClinic(cid, "catalog.manage");
  await requireClinic(target.data, "catalog.manage");
  const { error } = await client.rpc("attach_doctor", {
    source_clinic: cid,
    source_id: id,
    target_clinic: target.data,
  });
  if (error) return { error: databaseMessage(error.code, error.message) };
  revalidatePath(`/clinics/${cid}/doctors`, "layout");
  revalidatePath(`/clinics/${target.data}/doctors`, "layout");
  return {
    success:
      "Medicul a fost afiliat la locația selectată. Configurați acolo specialitățile, serviciile și programul.",
  };
}
