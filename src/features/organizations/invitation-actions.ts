"use server";
import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireClinic, requireUser } from "@/features/auth/access";
import { appOrigin } from "@/lib/app-origin";
import type { ActionState } from "@/features/auth/actions";
import { invitationSchema, invitationTokenSchema } from "./invitation-model";
import { deliverStaffInvitation } from "./invitation-delivery";
export async function inviteStaff(cid: string, _: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireClinic(cid, "members.manage");
  const input = invitationSchema.safeParse(Object.fromEntries(form)); if (!input.success) return { error: "Verificați emailul și rolul colegului." };
  const origin = appOrigin();
  const token = randomBytes(32).toString("base64url");
  const { data, error } = await client.rpc("create_staff_invite", { cid, target_email: input.data.email, target_role: input.data.role, digest: createHash("sha256").update(token).digest("hex") });
  if (error || !data) return { error: "Invitația nu a putut fi creată. Verificați accesul sau reîncercați mai târziu." };
  const invitationUrl = `${origin}/invitations/${token}`;
  const delivery = await deliverStaffInvitation(input.data.email, invitationUrl, data);
  revalidatePath(`/clinics/${cid}/team`);
  return { success: "Invitația a fost creată. " + delivery, invitationUrl };
}
export async function revokeInvite(cid: string, iid: string, _: ActionState): Promise<ActionState> {
  void _;
  const { client } = await requireClinic(cid, "members.manage");
  if (!z.uuid().safeParse(iid).success) return { error: "Invitație invalidă." };
  const { error } = await client.rpc("revoke_staff_invite", { iid });
  if (error) return { error: "Invitația nu a putut fi revocată." };
  revalidatePath(`/clinics/${cid}/team`); return { success: "Invitația a fost revocată." };
}
export async function acceptInvitation(token: string, _: ActionState): Promise<ActionState> {
  void _;
  const { client } = await requireUser();
  if (!invitationTokenSchema.safeParse(token).success) return { error: "Invitație invalidă." };
  const { data, error } = await client.rpc("accept_staff_invite", { digest: createHash("sha256").update(token).digest("hex") });
  if (error) return { error: "Invitația este expirată, revocată, deja folosită sau destinată altei adrese de email. Solicitați un link nou administratorului." };
  revalidatePath("/", "layout"); redirect(`/clinics/${data}`);
}
