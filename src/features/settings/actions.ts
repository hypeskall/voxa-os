"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, requireClinic } from "@/features/auth/access";
import type { ActionState } from "@/features/auth/actions";
import {
  clinicSchema,
  organizationSchema,
  preferencesSchema,
} from "@/lib/validation";
import { roles } from "@/lib/permissions";
import { draftSchema, validateStep, defaultHours } from "@/features/onboarding/model";
export async function saveOrganization(
  id: string,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client, clinic } = await requireClinic(id, "organization.manage");
  const input = draftSchema.shape.clinic.safeParse({ name: form.get("name"), legal_name: form.get("legal_name") ?? "", cui: form.get("cui") ?? "", phone: form.get("phone") ?? "", email: form.get("email") ?? "", website: form.get("website") ?? "", specialty: form.get("specialty") ?? "" });
  if (!input.success)
    return { error: "Denumirea trebuie să conțină 2–100 caractere." };
  const validation = validateStep({ clinic: input.data, locations: [{ id: clinic.id, name: clinic.name, address: "", city: "", county: "", phone: "", email: "", hours: defaultHours() }], doctors: [], services: [], rooms: [], team: [] },1);
  if(validation) return {error:validation};
  const { error } = await client.rpc("save_organization_identity",{oid:clinic.organization_id,payload:input.data});
  if (error)
    return { error: "Organizația nu a putut fi actualizată." };
  revalidatePath("/", "layout");
  return { success: "Datele organizației au fost salvate." };
}
export async function createOrganization(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client } = await requireUser();
  const input = organizationSchema.safeParse(Object.fromEntries(form));
  if (!input.success)
    return { error: "Completați denumirile (2–100 caractere)." };
  const { error } = await client.rpc("create_organization", {
    org_name: input.data.name,
    clinic_name: input.data.clinicName,
  });
  if (error)
    return {
      error:
        "Organizația nu a putut fi creată. Verificați dacă aveți deja acces atribuit.",
    };
  revalidatePath("/", "layout");
  redirect("/onboarding");
}
export async function saveClinic(
  id: string,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client } = await requireClinic(id, "clinic.manage");
  const input = clinicSchema.safeParse(Object.fromEntries(form));
  if (!input.success)
    return { error: "Verificați datele clinicii și configurația calendarului." };
  const { data, error } = await client
    .from("clinics")
    .update(input.data)
    .eq("id", id)
    .select("id");
  if (error || !data?.length)
    return {
      error:
        "Locația nu a putut fi salvată. Denumirea trebuie să fie unică în organizație.",
    };
  revalidatePath("/", "layout");
  return { success: "Datele clinicii au fost salvate." };
}
export async function addClinic(
  id: string,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client, clinic } = await requireClinic(id, "organization.manage");
  const input = clinicSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return { error: "Verificați datele locației." };
  const { data, error } = await client.rpc("create_location", {
    oid: clinic.organization_id,
    payload: input.data,
  });
  if (error)
    return {
      error:
        "Locația nu a putut fi creată. Verificați denumirea unică și accesul.",
    };
  revalidatePath("/", "layout");
  redirect(`/clinics/${data}`);
}
export async function savePreferences(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client, user } = await requireUser();
  const input = preferencesSchema.safeParse({
    density: form.get("density"),
    calendar_view: form.get("calendar_view"),
    default_clinic_id: form.get("default_clinic_id"),
    patient_columns: form.getAll("patient_columns"),
    dashboard_modules: form.getAll("dashboard_modules"),
  });
  if (!input.success)
    return { error: "Preferințele selectate nu sunt valide." };
  if (input.data.default_clinic_id)
    await requireClinic(input.data.default_clinic_id);
  const { error } = await client
    .from("user_preferences")
    .upsert({
      user_id: user.id,
      density: input.data.density,
      default_clinic_id: input.data.default_clinic_id,
      calendar_view: input.data.calendar_view,
      visible_columns: { patients: input.data.patient_columns },
      dashboard_modules: input.data.dashboard_modules,
    }, { onConflict: "user_id" });
  if (error) return { error: "Preferințele nu au putut fi salvate." };
  revalidatePath("/", "layout");
  return { success: "Preferințele au fost salvate." };
}
export async function saveMember(
  id: string,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client } = await requireClinic(id, "members.manage");
  const input = z
    .object({
      email: z.email().max(254),
      role: z.enum(roles),
      active: z.enum(["true", "false"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return { error: "Verificați emailul și rolul selectat." };
  const { error } = await client.rpc("set_membership", {
    cid: id,
    target_email: input.data.email,
    target_role: input.data.role,
    is_active: input.data.active === "true",
  });
  if (error)
    return {
      error:
        "Accesul nu a putut fi modificat. Contul trebuie să existe; nu vă puteți modifica propriul acces sau elimina ultimul proprietar.",
    };
  revalidatePath(`/clinics/${id}/team`);
  return { success: "Accesul utilizatorului a fost actualizat." };
}
