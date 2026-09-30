import "server-only";

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
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "Idempotency-Key": message.idempotencyKey }, body: JSON.stringify(message), signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`Furnizor indisponibil (${response.status}).`);
    const data = await response.json().catch(() => ({})) as { id?: string; delivered?: boolean };
    return { status: data.delivered ? "DELIVERED" : "SENT", providerMessageId: String(data.id ?? crypto.randomUUID()).slice(0, 250) };
  }
}

export function notificationProvider(): NotificationProvider {
  return process.env.NOTIFICATION_PROVIDER === "webhook" ? new WebhookProvider() : new DevelopmentProvider();
}
