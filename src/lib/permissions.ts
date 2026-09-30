export const roles = [
  "OWNER",
  "ADMIN",
  "RECEPTION",
  "DOCTOR",
  "ASSISTANT",
] as const;
export type Role = (typeof roles)[number];
export const permissions = [
  "clinic.read",
  "clinic.manage",
  "members.read",
  "members.manage",
  "audit.read",
  "organization.manage",
  "patients.read",
  "patients.manage",
  "catalog.read",
  "catalog.manage",
  "availability.read",
  "availability.manage",
  "appointments.read",
  "appointments.manage",
  "appointments.override",
  "notifications.read",
  "notifications.manage",
  "documents.read",
  "documents.manage",
  "results.read",
  "results.manage",
  "results.release",
  "credentials.manage",
  "reports.read",
] as const;
export type Permission = (typeof permissions)[number];
// Database role_permissions is authoritative; no role decisions in UI.
export function can(granted: readonly string[], permission: Permission) {
  return granted.includes(permission);
}
