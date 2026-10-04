// Operator-only configuration: credentials stay in ignored .env.mail.local.
export function mailSettings(env) {
  if (env.MAIL_PROVIDER !== "brevo" || env.SMTP_HOST !== "smtp-relay.brevo.com"
    || !["465", "587"].includes(env.SMTP_PORT)
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.SMTP_USER || "")
    || typeof env.SMTP_PASSWORD !== "string" || env.SMTP_PASSWORD.length < 16
    || env.SMTP_PASSWORD.length > 2048 || /\s/.test(env.SMTP_PASSWORD)
    || /replace|placeholder/i.test(env.SMTP_USER + env.SMTP_PASSWORD)
    || env.SMTP_FROM !== "noreply@notify.voxatech.ro"
    || env.SMTP_REPLY_TO !== "contact@voxatech.ro")
    throw new Error("Complete the reviewed transactional SMTP configuration.");
  const quota = Number(env.AUTH_EMAIL_HOURLY_LIMIT);
  // The initial Free pilot budgets up to 240 Auth messages/day, leaving room
  // for staff invitations/operator messages within the shared 300/day plan.
  if (!Number.isInteger(quota) || quota < 2 || quota > 10)
    throw new Error("Use a reviewed pilot Auth quota between 2 and 10 per hour.");
  return { host: env.SMTP_HOST, port: Number(env.SMTP_PORT), user: env.SMTP_USER,
    pass: env.SMTP_PASSWORD, from: env.SMTP_FROM, replyTo: env.SMTP_REPLY_TO, hourlyLimit: quota };
}

export function approvedMailSettings(env, ref) {
  const settings = mailSettings(env);
  if (env.MAIL_CONFIGURATION_APPROVED !== "true" || env.MAIL_APPROVED_PROJECT_REF !== ref
    || env.MAIL_DOMAIN_VERIFIED !== "true")
    throw new Error("Verify the sender domain and approve the exact mail target first.");
  return settings;
}

export function mailTransportOptions(mail) {
  return { host: mail.host, port: mail.port, secure: mail.port === 465, requireTLS: true,
    auth: { user: mail.user, pass: mail.pass }, tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true };
}
