export function normalizePhoneE164(raw: string) {
  const input = raw.trim();
  if (!input) return null;
  const compact = input.replace(/[\s().-]/g, "");
  let normalized = compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
  if (/^0\d{9}$/.test(normalized)) normalized = `+40${normalized.slice(1)}`;
  if (/^40\d{9}$/.test(normalized)) normalized = `+${normalized}`;
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) return null;
  return normalized;
}

export const defaultWhatsappReminderTemplate = "Bună ziua, {{patient_first_name}}. Vă reamintim că mâine, {{date}}, la ora {{time}}, aveți o programare la {{clinic_name}}, {{clinic_address}}. Dacă nu mai puteți ajunge, vă rugăm să ne anunțați. Vă mulțumim.";

export type ReminderVariables = Record<"patient_first_name" | "patient_name" | "date" | "time" | "service_name" | "doctor_name" | "clinic_name" | "clinic_address" | "clinic_phone", string>;

export function renderReminderTemplate(template: string, variables: ReminderVariables) {
  return template.replace(/{{\s*(patient_first_name|patient_name|date|time|service_name|doctor_name|clinic_name|clinic_address|clinic_phone)\s*}}/g, (_, key: keyof ReminderVariables) => variables[key] ?? "");
}

export function whatsappUrl(phone: string, message: string) {
  const normalized = normalizePhoneE164(phone);
  return normalized ? `https://wa.me/${normalized.slice(1)}?text=${encodeURIComponent(message)}` : null;
}
