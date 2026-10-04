import "server-only";
import nodemailer from "nodemailer";
import { createHash } from "node:crypto";
import { z } from "zod";
import { adminDb } from "@/lib/supabase/admin";

const address = z.email().max(254);
export function smtpTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !/^[a-z0-9.-]+$/i.test(host) || ![465, 587].includes(port) || !user || !pass)
    throw new Error("Serviciul de email nu este configurat.");
  return nodemailer.createTransport({
    host, port, secure: port === 465, requireTLS: true,
    auth: { user, pass }, tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true,
  });
}

export async function sendTransactionalEmail(input: { to: string; subject: string; text: string; key: string }) {
  const from = address.parse(process.env.SMTP_FROM);
  const to = address.parse(input.to);
  const replyTo = process.env.SMTP_REPLY_TO ? address.parse(process.env.SMTP_REPLY_TO) : undefined;
  if (/\r|\n/.test(input.subject) || input.subject.length > 200 || !input.key)
    throw new Error("Mesaj de email invalid.");
  const messageId = `<${createHash("sha256").update(input.key).digest("hex")}@${from.split("@")[1]}>`;
  const transport = smtpTransport();
  const digest = createHash("sha256").update(input.key).digest("hex");
  const client = adminDb();
  try {
    const claim = await client.rpc("claim_transactional_email", { digest });
    if (claim.error) throw new Error("Trimiterea emailului nu a putut fi înregistrată.");
    if (claim.data === "accepted") return { messageId };
    if (claim.data !== "claimed") throw new Error("Trimiterea anterioară trebuie verificată înainte de retrimitere.");
    try {
      const result = await transport.sendMail({
        from: { name: "Voxa-OS", address: from }, to, ...(replyTo ? {replyTo} : {}), subject: input.subject,
        text: input.text, messageId,
      });
      if (!result.accepted.some(recipient => String(recipient).toLowerCase() === to.toLowerCase()))
        throw new Error("SMTP acknowledgement unavailable");
    } catch {
      await client.rpc("finish_transactional_email", { digest, outcome: "uncertain" });
      throw new Error("Trimiterea emailului nu a fost confirmată. Verificați serviciul înainte de retrimitere.");
    }
    const acknowledgement = await client.rpc("finish_transactional_email", { digest, outcome: "accepted" });
    if (acknowledgement.error) throw new Error("Confirmarea trimiterii trebuie verificată înainte de retrimitere.");
    return { messageId };
  } finally { transport.close(); }
}
