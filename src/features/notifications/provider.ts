import "server-only";
import { sendTransactionalEmail } from "@/lib/email/smtp";
import { z } from "zod";

export type NotificationMessage = { channel: "SMS" | "EMAIL"; recipient: string; subject: string; body: string; idempotencyKey: string };
export type Delivery = { status: "SENT" | "DELIVERED"; providerMessageId: string };
export interface NotificationProvider { send(message: NotificationMessage): Promise<Delivery> }

class DevelopmentProvider implements NotificationProvider {
  async send(message: NotificationMessage): Promise<Delivery> {
    const masked = message.channel === "EMAIL" ? `${message.recipient.slice(0, 1)}***@${message.recipient.split("@")[1] ?? ""}` : `***${message.recipient.replace(/\D/g, "").slice(-4)}`;
    console.info("[notification:development]", { channel: message.channel, recipient: masked, idempotencyKey: message.idempotencyKey });
    return { status: "SENT", providerMessageId: `dev-${crypto.randomUUID()}` };
  }
}

class WebhookProvider implements NotificationProvider {
  async send(message: NotificationMessage): Promise<Delivery> {
    const url = process.env.NOTIFICATION_PROVIDER_URL;
    const token = process.env.NOTIFICATION_PROVIDER_TOKEN;
    if (!url || !token) throw new Error("Furnizorul de notificări nu este configurat.");
    const target = new URL(url);
    if (target.protocol !== "https:" || target.username || target.password) throw new Error("Configurație nesigură a furnizorului.");
    const response = await fetch(target, { method: "POST", redirect: "error", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "Idempotency-Key": message.idempotencyKey }, body: JSON.stringify(message), signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`Furnizor indisponibil (${response.status}).`);
    const data = await response.json().catch(() => ({})) as { id?: string; delivered?: boolean };
    return { status: data.delivered ? "DELIVERED" : "SENT", providerMessageId: String(data.id ?? crypto.randomUUID()).slice(0, 250) };
  }
}

class SmtpProvider implements NotificationProvider {
  async send(message: NotificationMessage): Promise<Delivery> {
    if (message.channel !== "EMAIL") throw new Error("SMS nu este configurat. Folosiți canalul email.");
    const recipient = z.email().max(254).parse(message.recipient);
    const domain = recipient.split("@")[1].toLowerCase();
    if (["test", "invalid", "localhost", "example", "example.com", "example.org", "example.net"].some(reserved => domain === reserved || domain.endsWith(`.${reserved}`)))
      throw new Error("Adresa demonstrativă nu poate primi emailuri reale.");
    const result = await sendTransactionalEmail({ to: message.recipient, subject: message.subject,
      text: message.body, key: `patient-notification:${message.idempotencyKey}` });
    return { status: "SENT", providerMessageId: result.messageId };
  }
}

export function notificationProvider(): NotificationProvider {
  if (process.env.NOTIFICATION_PROVIDER === "webhook") return new WebhookProvider();
  if (process.env.NOTIFICATION_PROVIDER === "smtp") return new SmtpProvider();
  if (process.env.APP_ENVIRONMENT === "production" || process.env.VERCEL_ENV === "production")
    throw new Error("Furnizorul de notificări pentru producție nu este configurat.");
  return new DevelopmentProvider();
}
