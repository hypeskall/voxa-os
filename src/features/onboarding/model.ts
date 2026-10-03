import { z } from "zod";
const text = (max: number) => z.string().trim().max(max);
const id = z.uuid();
export const hoursSchema = z.object({ weekday: z.number().int().min(1).max(7), closed: z.boolean(), start_time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/), end_time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/) }).strict();
export const draftSchema = z.object({
  clinic: z.object({ name: text(100), legal_name: text(160), cui: text(30), phone: text(40), email: text(254), website: text(500), specialty: text(120) }).strict(),
  locations: z.array(z.object({ id, name: text(100), address: text(250), city: text(100), county: text(100), phone: text(40), email: text(254), hours: z.array(hoursSchema).length(7) }).strict()).min(1).max(20),
  services: z.array(z.object({ id, location_id: id, name: text(160), description: text(2000), price: text(12), duration_minutes: z.number().int().min(5).max(1440) }).strict()).max(200),
  doctors: z.array(z.object({ id, first_name: text(80), last_name: text(80), specialty: text(120), professional_code: text(60), email: text(254), phone: text(40), color: z.string().regex(/^#[a-fA-F0-9]{6}$/), location_ids: z.array(id).max(20), service_ids: z.array(id).max(200) }).strict()).max(100),
  rooms: z.array(z.object({ id, location_id: id, name: text(120), description: text(100) }).strict()).max(100),
  team: z.array(z.object({ id, location_id: id, email: text(254), role: z.enum(["ADMIN", "RECEPTION", "DOCTOR"]) }).strict()).max(30),
}).strict();
export type OnboardingDraft = z.infer<typeof draftSchema>;
export const defaultHours = () => [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, closed: weekday > 5, start_time: "08:00", end_time: "18:00" }));
export const steps = ["Clinica", "Locații", "Program", "Servicii", "Medici", "Cabinete", "Echipă", "Finalizare"];
const validEmail = (value: string, optional = true) => (optional && !value) || z.email().safeParse(value).success;
const validPhone = (value: string) => !value || /^[+\d ()-]{7,40}$/.test(value);
export function validateStep(draft: OnboardingDraft, step: number): string | null {
  const d = draftSchema.safeParse(draft);
  if (!d.success) return "Verificați câmpurile și limitele formularului.";
  if (step === 1 && (draft.clinic.name.length < 2 || !validEmail(draft.clinic.email, false) || !validPhone(draft.clinic.phone) || (draft.clinic.website && !z.url({ protocol: /^https?$/ }).safeParse(draft.clinic.website).success))) return "Completați denumirea și emailul clinicii; verificați telefonul și website-ul.";
  if (step === 2 && draft.locations.some((l) => l.name.length < 2 || l.city.length < 2 || !validEmail(l.email) || !validPhone(l.phone))) return "Fiecare locație are nevoie de denumire și oraș; verificați datele de contact.";
  if (step === 3 && draft.locations.some((l) => !l.hours.some((h) => !h.closed) || new Set(l.hours.map((h) => h.weekday)).size !== 7 || l.hours.some((h) => !h.closed && (h.end_time <= h.start_time || h.start_time > "23:59" || h.end_time > "23:59")))) return "Configurați cel puțin o zi deschisă în fiecare locație și intervale valide.";
  if (step === 4 && (!draft.services.length || draft.services.some((s) => s.name.length < 2 || !/^\d{1,8}(\.\d{1,2})?$/.test(s.price) || !draft.locations.some((l) => l.id === s.location_id)))) return "Adăugați cel puțin un serviciu cu denumire, preț valid și locație.";
  if (step === 5) {
    if (!draft.doctors.length || draft.doctors.some((doc) => doc.first_name.length < 2 || doc.last_name.length < 2 || !validEmail(doc.email) || !validPhone(doc.phone) || !doc.location_ids.length || !doc.service_ids.length || doc.location_ids.some((lid) => !draft.locations.some((l) => l.id === lid) || !doc.service_ids.some((sid) => draft.services.some((s) => s.id === sid && s.location_id === lid))) || doc.service_ids.some((sid) => !draft.services.some((s) => s.id === sid && doc.location_ids.includes(s.location_id))))) return "Fiecare medic are nevoie de nume, locații și servicii compatibile în fiecare locație.";
    if (draft.services.some((s) => !draft.doctors.some((doc) => doc.service_ids.includes(s.id) && doc.location_ids.includes(s.location_id)))) return "Atribuiți fiecărui serviciu cel puțin un medic.";
  }
  if (step === 6 && draft.rooms.some((r) => r.name.length < 2 || !draft.locations.some((l) => l.id === r.location_id))) return "Verificați denumirea și locația cabinetelor.";
  if (step === 7 && draft.team.some((member) => !validEmail(member.email, false) || !draft.locations.some((l) => l.id === member.location_id))) return "Verificați emailul și locația fiecărei invitații.";
  if (step === 7 && new Set(draft.team.map((t)=>`${t.location_id}:${t.email.toLowerCase()}`)).size!==draft.team.length) return "O adresă poate primi o singură invitație pentru aceeași locație.";
  const entities = [...draft.locations, ...draft.services, ...draft.doctors, ...draft.rooms, ...draft.team];
  if (new Set(entities.map((item) => item.id)).size !== entities.length) return "Identificatorii înregistrărilor trebuie să fie unici.";
  return null;
}
export function validateSetup(draft: OnboardingDraft) {
  for (let step = 1; step <= 7; step++) { const error = validateStep(draft, step); if (error) return error; }
  return null;
}
