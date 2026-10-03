"use server";
import { randomBytes, createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrganization } from "@/features/organizations/access";
import { appOrigin } from "@/lib/app-origin";
import { validateMedicalFile } from "@/lib/file-validation";
import { MAX_UPLOAD_BYTES } from "@/lib/medical-storage";
import { cleanupUploads } from "@/lib/storage-cleanup";
import { deliverStaffInvitation } from "@/features/organizations/invitation-delivery";
import { draftSchema, validateSetup, validateStep } from "./model";
import type { ActionState } from "@/features/auth/actions";

export async function persistSetup(oid: string, raw: unknown, step: number, revision: number, previousStep?: number) {
  const { client } = await requireOrganization(oid, true, true);
  const input = draftSchema.safeParse(raw);
  if (!input.success || !z.number().int().min(1).max(8).safeParse(step).success || !z.number().int().nonnegative().safeParse(revision).success) return { error: "Verificați formularul." };
  if (previousStep !== undefined) {
    if (!z.number().int().min(1).max(8).safeParse(previousStep).success) return { error: "Pas invalid." };
    if (step > previousStep) { const error = validateStep(input.data, previousStep); if (error) return { error }; }
  }
  const { data, error } = await client.rpc("save_onboarding", { oid, draft: input.data, next_step: step, expected_revision: revision });
  if (error) return { error: error.code === "40001" ? "Configurarea a fost modificată în altă fereastră. Reîncărcați pagina." : "Configurarea nu a putut fi salvată. Reîncercați." };
  return { revision: data };
}
export async function completeSetup(oid: string, raw: unknown, revision: number) {
  const { client } = await requireOrganization(oid, true, true);
  const parsed = draftSchema.safeParse(raw);
  if (!parsed.success) return { error: "Verificați configurarea." };
  const validation = validateSetup(parsed.data); if (validation) return { error: validation };
  const saved = await persistSetup(oid, parsed.data, 8, revision); if (saved.error || saved.revision === undefined) return saved;
  const origin = appOrigin();
  const digests: Record<string, string> = {};
  const invitations = parsed.data.team.map((member) => { const token = randomBytes(32).toString("base64url"); digests[member.id] = createHash("sha256").update(token).digest("hex"); return { email: member.email, url: `${origin}/invitations/${token}` }; });
  const { data, error } = await client.rpc("finish_onboarding", { oid, expected_revision: saved.revision, invite_digests: digests });
  if (error) return { error: "Configurarea nu a putut fi finalizată. Verificați denumirile unice, serviciile și programul fiecărei locații.", revision: saved.revision };
  const delivered = await Promise.all(invitations.map(async invite => ({ ...invite, delivery: await deliverStaffInvitation(invite.email, invite.url, crypto.randomUUID()) })));
  // The clinic routes read the database on navigation. Refreshing the current
  // onboarding page here would redirect before one-time invitation links render.
  return { clinicId: data, invitations: delivered, revision: saved.revision };
}
export async function uploadOrganizationLogo(oid: string, _: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireOrganization(oid, true, true);
  const file = form.get("file"); if (!(file instanceof File)) return { error: "Selectați o imagine." };
  const mime = await validateMedicalFile(file, ["image/png", "image/jpeg", "image/webp"], MAX_UPLOAD_BYTES);
  if (!mime) return { error: "Folosiți PNG, JPEG sau WebP de cel mult 3 MB." };
  const path = `${oid}/logo/${crypto.randomUUID()}`;
  const uploaded = await client.storage.from("voxa-branding").upload(path, file, { contentType: mime });
  if (uploaded.error) { const cleanup = await cleanupUploads(client, "voxa-branding", [path]); return { error: "Logo-ul nu a putut fi încărcat." + cleanup }; }
  const saved = await client.rpc("set_organization_logo", { oid, path });
  if (saved.error) { const cleanup = await cleanupUploads(client, "voxa-branding", [path]); return { error: "Logo-ul nu a putut fi asociat clinicii." + cleanup }; }
  revalidatePath("/onboarding");
  return { success: "Logo-ul a fost salvat în spațiul privat." };
}
