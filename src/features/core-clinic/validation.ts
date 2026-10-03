import { z } from "zod";
import { moduleSpecs, type CoreModule } from "./model";
const name = z
  .string()
  .trim()
  .min(2, "Completați numele (minimum 2 caractere).")
  .max(160);
const text = (max: number) => z.string().trim().max(max);
const id = z.union([z.uuid(), z.literal("")]).transform((v) => v || null);
const ids = z
  .array(z.uuid())
  .max(200)
  .transform((v) => [...new Set(v)]);
const email = z.union([z.email().max(254), z.literal("")]);
const active = z.enum(["true", "false"]).transform((v) => v === "true");
const date = z.union([z.iso.date(), z.literal("")]).transform((v) => v || null);
const lines = z
  .string()
  .max(20000)
  .transform((v) =>
    v
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.string().max(400)).max(50));
const resource = {
  resource_kind: z.enum(["clinic", "doctor", "room", "equipment"]),
  doctor_location_id: id,
  room_id: id,
  equipment_id: id,
};
const schemas = {
  patients: z.object({
    name,
    internal_id: text(50).min(1),
    cnp: z.union([z.string().trim().regex(/^[0-9]{13}$/), z.literal("")]).default("").transform((value) => value || null),
    birth_date: date.refine(
      (v) =>
        !v || (v >= "1900-01-01" && v <= new Date().toISOString().slice(0, 10)),
      "Data nașterii nu este validă.",
    ),
    sex: z.enum(["female", "male", "other", "unspecified"]),
    phone: text(40),
    email,
    address: text(500),
    city: text(100),
    postal_code: text(20),
    country: text(100),
    administrative_notes: text(5000),
    active,
  }),
  doctors: z.object({
    name,
    professional_code: text(60).min(1),
    phone: text(40),
    email,
    speciality_ids: ids,
    service_ids: ids,
    room_ids: ids,
    active,
  }),
  specialities: z.object({
    name: name.max(120),
    description: text(2000),
    active,
  }),
  categories: z.object({
    name: name.max(120),
    description: text(2000),
    active,
  }),
  rooms: z.object({
    name: name.max(120),
    type: text(100),
    capacity: z.coerce.number().int().min(1).max(100),
    active,
  }),
  equipment: z.object({
    name: name.max(120),
    type: text(100),
    capacity: z.coerce.number().int().min(1).max(100),
    internal_id: text(50).min(1),
    room_id: id,
    active,
  }),
  services: z.object({
    name,
    category_id: id,
    duration_minutes: z.coerce.number().int().min(5).max(1440),
    price: z.union([
      z.literal("").transform(() => null),
      z
        .string()
        .regex(
          /^\d+(\.\d{1,2})?$/,
          "Prețul trebuie să fie pozitiv și să aibă maximum două zecimale.",
        )
        .transform(Number)
        .pipe(z.number().max(99999999)),
    ]),
    buffer_before: z.coerce.number().int().min(0).max(240),
    buffer_after: z.coerce.number().int().min(0).max(240),
    doctor_requirement: z.enum(["required", "optional", "none"]),
    room_required: z.enum(["true", "false"]).transform((v) => v === "true"),
    minimum_room_capacity: z.coerce.number().int().min(1).max(100),
    doctor_ids: ids,
    room_ids: ids,
    equipment_ids: ids,
    instructions: text(10000),
    required_documents: lines,
    exclusion_rules: lines,
    active,
  }),
  availability: z
    .object({
      name,
      ...resource,
      weekday: z.coerce.number().int().min(1).max(7),
      start_time: z.iso.time(),
      end_time: z.iso.time(),
      valid_from: z.iso.date(),
      valid_until: date,
      interval_kind: z.enum(["work", "break"]),
      active,
    })
    .refine(
      (v) => v.end_time > v.start_time,
      "Ora de sfârșit trebuie să fie după ora de început.",
    )
    .refine(
      (v) => !v.valid_until || v.valid_until >= v.valid_from,
      "Verificați perioada de valabilitate.",
    ),
  exceptions: z
    .object({
      name,
      ...resource,
      starts_at: z.iso.datetime({ offset: true }),
      ends_at: z.iso.datetime({ offset: true }),
      exception_kind: z.enum([
        "extra_work",
        "closed",
        "holiday",
        "leave",
        "maintenance",
        "meeting",
        "manual",
      ]),
      notes: text(2000),
      active,
    })
    .refine(
      (v) => Date.parse(v.ends_at) > Date.parse(v.starts_at),
      "Sfârșitul trebuie să fie după început.",
    ),
} satisfies Record<CoreModule, z.ZodType>;
export function parseCore(
  module: CoreModule,
  form: FormData,
  timeZone: string,
) {
  const input: Record<string, unknown> = Object.fromEntries(form);
  for (const field of moduleSpecs[module].fields) {
    if (field.kind === "multiple") input[field.key] = form.getAll(field.key);
    const current = input[field.key];
    if (
      field.kind === "time" &&
      typeof current === "string" &&
      current.length === 5
    )
      input[field.key] = current + ":00";
    if (field.kind === "datetime")
      input[field.key] = localToInstant(
        String(input[field.key] ?? ""),
        timeZone,
      );
  }
  if (module === "availability" || module === "exceptions") {
    const kind = input.resource_kind;
    for (const [k, t] of [
      ["doctor_location_id", "doctor"],
      ["room_id", "room"],
      ["equipment_id", "equipment"],
    ])
      if (kind !== t) input[k] = "";
  }
  const parsed = schemas[module].parse(input);
  if ("resource_kind" in parsed) {
    const p = parsed as z.infer<typeof schemas.availability>;
    if (
      p.resource_kind !== "clinic" &&
      !{
        doctor: p.doctor_location_id,
        room: p.room_id,
        equipment: p.equipment_id,
      }[p.resource_kind]
    )
      throw new Error("Selectați resursa căreia i se aplică intervalul.");
  }
  return parsed;
}
// Resolve clinic wall time, never the browser/server machine timezone. Reject
// DST gaps and folds instead of silently moving an unavailable period.
export function localToInstant(local: string, timeZone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))
    throw new Error("Completați data și ora.");
  const base = Date.parse(local + "Z");
  if (!Number.isFinite(base)) throw new Error("Dată invalidă.");
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const matches: string[] = [];
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const d = new Date(base + offset * 60000);
    if (fmt.format(d).replace(" ", "T") === local)
      matches.push(d.toISOString());
  }
  if (matches.length !== 1)
    throw new Error(
      matches.length
        ? "Ora se repetă la trecerea la ora de iarnă. Alegeți o oră neambiguă pentru limita intervalului."
        : "Ora nu există în fusul clinicii. Verificați trecerea la ora de vară.",
    );
  return matches[0];
}
export function instantToLocal(value: string, timeZone: string) {
  if (!value) return "";
  const date = new Date(value);
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(date)
    .replace(" ", "T");
}
