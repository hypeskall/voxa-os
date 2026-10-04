import "server-only";
import { sendTransactionalEmail } from "@/lib/email/smtp";
import { appOrigin } from "@/lib/app-origin";

export async function deliverStaffInvitation(email: string, invitationUrl: string, invitationId: string): Promise<string> {
  if ((process.env.STAFF_INVITATION_PROVIDER ?? "manual") === "manual")
    return "Livrare manuală: copiați linkul și trimiteți-l colegului. Emailul nu a fost trimis automat.";
  try {
    if (process.env.STAFF_INVITATION_PROVIDER === "smtp") {
      const link = new URL(invitationUrl);
      if (link.origin !== appOrigin() || !/^\/invitations\/[A-Za-z0-9_-]{43}$/.test(link.pathname) || link.search || link.hash)
        throw new Error("Invalid invitation destination");
      await sendTransactionalEmail({ to: email, subject: "Invitație în echipa clinicii · Voxa-OS",
        text: `Ai fost invitat în echipa unei clinici care folosește Voxa-OS.\n\nDeschide linkul și conectează-te sau creează un cont cu această adresă de email:\n${invitationUrl}\n\nLinkul expiră după 7 zile și poate fi folosit o singură dată. Dacă nu așteptai invitația, poți ignora acest mesaj.`,
        key: `staff-invitation:${invitationId}` });
      return "Serviciul de email a acceptat invitația pentru trimitere. Linkul expiră după 7 zile.";
    }
    if (process.env.STAFF_INVITATION_PROVIDER !== "webhook") throw new Error("Unsupported provider");
    const url = new URL(process.env.STAFF_INVITATION_PROVIDER_URL ?? "");
    const token = process.env.STAFF_INVITATION_PROVIDER_TOKEN;
    if (url.protocol !== "https:" || url.username || url.password || !token) throw new Error("Missing provider configuration");
    const response = await fetch(url, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(10000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "Idempotency-Key": invitationId },
      body: JSON.stringify({ kind: "staff_invitation", to: email, invitationUrl, expiresInDays: 7 }),
    });
    if (!response.ok) throw new Error("Provider did not acknowledge");
    return "Serviciul de email a acceptat invitația pentru trimitere. Linkul expiră după 7 zile.";
  } catch {
    // A timeout can mean delivery is uncertain. Never claim it was sent or
    // automatically retry a new token; the provider uses the invitation key.
    return "Trimiterea emailului nu a fost confirmată. Copiați linkul pentru livrare manuală sau verificați serviciul de email.";
  }
}
