import { requireClinic } from "@/features/auth/access";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, Select } from "@/components/ui/form";
import { Section, Table } from "@/components/ui/page";
import { inviteStaff, revokeInvite } from "./invitation-actions";
import { formatInTimeZone } from "@/lib/time";
export async function TeamInvitations({ cid }: { cid: string }) {
  const { client, clinic } = await requireClinic(cid, "members.manage");
  const { data, error } = await client.from("organization_invites").select("id,email,role,expires_at,accepted_at,revoked_at").eq("clinic_id", cid).order("created_at", { ascending: false }).limit(50);
  if (error) throw new Error("Invitațiile nu au putut fi încărcate.");
  return <Section title="Invită un coleg" description="Nu este necesar un cont existent. Linkul este destinat exclusiv adresei indicate."><div className="max-w-xl"><ActionForm action={inviteStaff.bind(null, cid)} submit="Creează invitația"><Field label="Email coleg"><Input name="email" type="email" required maxLength={254}/></Field><Field label="Rol coleg"><Select name="role" defaultValue="RECEPTION"><option value="ADMIN">Administrator</option><option value="RECEPTION">Recepție</option><option value="DOCTOR">Medic</option></Select></Field></ActionForm></div><Table><thead><tr><th>Email</th><th>Rol</th><th>Stare</th><th>Acțiune</th></tr></thead><tbody>{data.map((i) => <tr key={i.id}><td>{i.email}</td><td>{i.role === "ADMIN" ? "Administrator" : i.role === "DOCTOR" ? "Medic" : "Recepție"}</td><td>{i.accepted_at ? "Acceptată" : i.revoked_at ? "Revocată" : new Date(i.expires_at) < new Date() ? "Expirată" : `Valabilă până la ${formatInTimeZone(i.expires_at, clinic.timezone)}`}</td><td>{!i.accepted_at && !i.revoked_at && <ActionForm action={revokeInvite.bind(null, cid, i.id)} submit="Revocă"/>}</td></tr>)}{!data.length && <tr><td colSpan={4}>Nu există invitații.</td></tr>}</tbody></Table><p className="muted">Pentru un medic, asociați ulterior contul cu resursa profesională din profilul medicului. Invitația nu acordă acces la toate datele clinicii.</p></Section>;
}
