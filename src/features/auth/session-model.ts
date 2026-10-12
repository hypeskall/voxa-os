export function safeSessionDestination(value: string | null) {
  if (value && ["/dashboard", "/account/security", "/reset-password", "/portal"].includes(value)) return value;
  if (value && /^\/invitations\/[A-Za-z0-9_-]{43}$/.test(value)) return value;
  if (value && /^\/clinics\/[a-f0-9-]{36}(?:\/settings\/organization|\/reports)?$/.test(value)) return value;
  if (value && /^\/api\/clinics\/[a-f0-9-]{36}\/patients\/[a-f0-9-]{36}\/export$/.test(value)) return value;
  return "/dashboard";
}
