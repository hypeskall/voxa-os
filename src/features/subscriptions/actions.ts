"use server";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireOrganization } from "@/features/organizations/access";
import type { ActionState } from "@/features/auth/actions";
import { LICENSE_PATTERN, normalizeLicense } from "./model";

export async function activateLicense(
  organizationId: string,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client } = await requireOrganization(organizationId, true);
  const raw = form.get("license");
  const code = typeof raw === "string" ? normalizeLicense(raw) : "";
  if (!LICENSE_PATTERN.test(code))
    return {
      error:
        "Verificați codul de licență primit. Copiați codul complet, inclusiv prefixul VOXA.",
    };
  const digest = createHash("sha256").update(code).digest("hex");
  const { data, error } = await client.rpc("activate_license", {
    oid: organizationId,
    digest,
  });
  if (error || !data)
    return {
      error:
        "Licența nu poate fi activată. Poate fi invalidă, expirată, revocată sau deja utilizată. După mai multe încercări, așteptați 15 minute.",
    };
  revalidatePath(`/organizations/${organizationId}`, "layout");
  revalidatePath("/dashboard");
  return { success: "Licența a fost activată. Puteți reveni în platformă." };
}
