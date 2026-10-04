import "server-only";
import { smtpTransport } from "./smtp";
import { z } from "zod";
let lastAlert = 0;

export async function alertServerError(reference: string, type: string) {
  // Throttle per server instance; an external monitor supplies global uptime alerts.
  if (Date.now() - lastAlert < 300000) return;
  lastAlert = Date.now();
  const address = z.email().safeParse(process.env.ERROR_ALERT_EMAIL);
  const from = z.email().safeParse(process.env.SMTP_FROM);
  if (!address.success || !from.success || !/^[a-z0-9-]{1,50}$/i.test(reference)) return;
  try {
    const transport = smtpTransport();
    try { await transport.sendMail({from:from.data,to:address.data,subject:"Voxa-OS · eroare de server",
      text:`A fost detectată o eroare de server.\nReferință: ${reference}\nTip: ${["render","route","action","proxy"].includes(type) ? type : "server"}\nMoment: ${new Date().toISOString()}\n\nVerifică jurnalul aplicației folosind referința. Acest mesaj nu conține date despre pacienți sau conturi.`}); }
    finally { transport.close(); }
  } catch { /* Monitoring must never recursively fail the request. */ }
}
