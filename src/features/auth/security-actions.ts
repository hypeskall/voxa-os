"use server";
import { revalidatePath } from "next/cache";
import { authenticatedUser, requireClinic } from "./access";
import { mfaRequired } from "./mfa";
import type { ActionState } from "./actions";
import { requireFreshSession } from "./session";
export async function revokeOtherSessions(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client } = await authenticatedUser();
  await requireFreshSession(client, "/account/security");
  if (await mfaRequired(client))
    return { error: "Confirmați mai întâi codul de verificare." };
  if (form.get("confirm") !== "on")
    return { error: "Confirmați deconectarea celorlalte dispozitive." };
  const { error } = await client.auth.signOut({ scope: "others" });
  if (error) return { error: "Celelalte sesiuni nu au putut fi revocate." };
  return {
    success:
      "Celelalte sesiuni au fost revocate. Tokenurile deja emise expiră conform duratei lor de valabilitate.",
  };
}
export async function saveMfaPolicy(
  cid: string,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client } = await requireClinic(cid, "organization.manage");
  await requireFreshSession(client, `/clinics/${cid}/settings/organization`);
  const { error } = await client.rpc("set_organization_mfa_policy", {
    cid,
    required: form.get("required") === "on",
  });
  if (error)
    return {
      error:
        "Configurați și verificați mai întâi autentificarea în doi pași pentru contul dumneavoastră.",
    };
  revalidatePath(`/clinics/${cid}/settings/organization`);
  return { success: "Politica de securitate a organizației a fost salvată." };
}
