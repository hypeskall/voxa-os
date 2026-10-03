import { z } from "zod";
import type { Permission } from "@/lib/permissions";

export const modules = [
  "patients",
  "doctors",
  "specialities",
  "services",
  "categories",
  "rooms",
  "equipment",
  "availability",
  "exceptions",
] as const;
export const moduleSchema = z.enum(modules);
export type CoreModule = z.infer<typeof moduleSchema>;
export type FieldSpec = {
  key: string;
  label: string;
  kind?:
    | "text"
    | "email"
    | "date"
    | "time"
    | "number"
    | "textarea"
    | "lines"
    | "select"
    | "relation"
    | "multiple"
    | "datetime";
  required?: boolean;
  min?: number;
  max?: number;
  step?: string;
  pattern?: string;
  options?: readonly (readonly [string, string])[];
  source?: CoreModule;
  hint?: string;
  defaultValue?: string | number;
};
export type ModuleSpec = {
  title: string;
  singular: string;
  description: string;
  permission: "patients" | "catalog" | "availability";
  fields: FieldSpec[];
  columns: readonly (readonly [string, string])[];
};
const name: FieldSpec = {
  key: "name",
  label: "Nume",
  required: true,
  max: 160,
};
const contact: FieldSpec[] = [
  { key: "phone", label: "Telefon", max: 40 },
  { key: "email", label: "Email", kind: "email", max: 254 },
];
const capacity: FieldSpec = {
  key: "capacity",
  label: "Capacitate",
  kind: "number",
  min: 1,
  max: 100,
  required: true,
  defaultValue: 1,
};
const type: FieldSpec = { key: "type", label: "Tip", max: 100 };
const resource: FieldSpec[] = [
  {
    key: "resource_kind",
    label: "Se aplică pentru",
    kind: "select",
    options: [
      ["clinic", "Întreaga clinică"],
      ["doctor", "Medic"],
      ["room", "Cabinet"],
      ["equipment", "Echipament"],
    ],
  },
  {
    key: "doctor_location_id",
    label: "Medic",
    kind: "relation",
    source: "doctors",
  },
  { key: "room_id", label: "Cabinet", kind: "relation", source: "rooms" },
  {
    key: "equipment_id",
    label: "Echipament",
    kind: "relation",
    source: "equipment",
  },
];
export const moduleSpecs: Record<CoreModule, ModuleSpec> = {
  patients: {
    title: "Pacienți",
    singular: "Pacient",
    description: "Registrul operațional al pacienților clinicii.",
    permission: "patients",
    columns: [
      ["name", "Pacient"],
      ["internal_id", "Identificator"],
      ["phone", "Telefon"],
      ["email", "Email"],
    ],
    fields: [
      { ...name, label: "Nume și prenume" },
      {
        key: "internal_id",
        label: "Identificator intern",
        required: true,
        max: 50,
        hint: "Unic în această clinică.",
      },
      { key: "birth_date", label: "Data nașterii", kind: "date" },
      { key: "cnp", label: "CNP (opțional)", max: 13, pattern: "[0-9]{13}", hint: "13 cifre. Este afișat numai în profilul autorizat al pacientului." },
      {
        key: "sex",
        label: "Sex",
        kind: "select",
        options: [
          ["unspecified", "Nespecificat"],
          ["female", "Feminin"],
          ["male", "Masculin"],
          ["other", "Altul"],
        ],
      },
      ...contact,
      { key: "address", label: "Adresă", max: 500 },
      { key: "city", label: "Localitate", max: 100 },
      { key: "postal_code", label: "Cod poștal", max: 20 },
      { key: "country", label: "Țară", max: 100, defaultValue: "România" },
      {
        key: "administrative_notes",
        label: "Note administrative",
        kind: "textarea",
        max: 5000,
        hint: "Doar informații necesare administrării pacientului.",
      },
    ],
  },
  doctors: {
    title: "Medici",
    singular: "Medic",
    description: "Echipa medicală, specialitățile, serviciile și programul asociat.",
    permission: "catalog",
    columns: [
      ["name", "Medic"],
      ["professional_code", "Identificator intern"],
      ["phone", "Telefon"],
      ["email", "Email"],
    ],
    fields: [
      { ...name, label: "Nume și prenume" },
      {
        key: "professional_code",
        label: "Identificator intern",
        required: true,
        max: 60,
        hint: "Identificator unic al medicului în organizație.",
      },
      ...contact,
      {
        key: "speciality_ids",
        label: "Specialități",
        kind: "multiple",
        source: "specialities",
      },
      {
        key: "service_ids",
        label: "Servicii oferite",
        kind: "multiple",
        source: "services",
      },
      {
        key: "room_ids",
        label: "Cabinete uzuale",
        kind: "multiple",
        source: "rooms",
      },
    ],
  },
  specialities: {
    title: "Specialități",
    singular: "Specialitate",
    description: "Nomenclatorul specialităților clinicii.",
    permission: "catalog",
    columns: [
      ["name", "Specialitate"],
      ["description", "Descriere"],
    ],
    fields: [
      { ...name, max: 120 },
      { key: "description", label: "Descriere", kind: "textarea", max: 2000 },
    ],
  },
  categories: {
    title: "Categorii de servicii",
    singular: "Categorie",
    description: "Organizarea serviciilor și investigațiilor.",
    permission: "catalog",
    columns: [
      ["name", "Categorie"],
      ["description", "Descriere"],
    ],
    fields: [
      { ...name, max: 120 },
      { key: "description", label: "Descriere", kind: "textarea", max: 2000 },
    ],
  },
  rooms: {
    title: "Cabinete",
    singular: "Cabinet",
    description: "Spații medicale, capacitate și program de lucru.",
    permission: "catalog",
    columns: [
      ["name", "Cabinet"],
      ["type", "Tip"],
      ["capacity", "Capacitate"],
    ],
    fields: [{ ...name, max: 120 }, type, capacity],
  },
  equipment: {
    title: "Echipamente",
    singular: "Echipament",
    description: "Resurse, amplasare și perioade de mentenanță.",
    permission: "catalog",
    columns: [
      ["name", "Echipament"],
      ["internal_id", "Identificator"],
      ["type", "Tip"],
      ["capacity", "Capacitate"],
    ],
    fields: [
      { ...name, max: 120 },
      type,
      {
        key: "internal_id",
        label: "Identificator intern",
        required: true,
        max: 50,
      },
      capacity,
      {
        key: "room_id",
        label: "Cabinet fix",
        kind: "relation",
        source: "rooms",
        hint: "Lăsați necompletat pentru un echipament mobil.",
      },
    ],
  },
  services: {
    title: "Servicii și investigații",
    singular: "Serviciu",
    description: "Durate, tarife, eligibilitate și cerințe configurabile.",
    permission: "catalog",
    columns: [
      ["name", "Serviciu"],
      ["duration_minutes", "Durată (min)"],
      ["price", "Preț (RON)"],
      ["buffer_before", "Buffer înainte"],
      ["buffer_after", "Buffer după"],
    ],
    fields: [
      name,
      {
        key: "category_id",
        label: "Categorie",
        kind: "relation",
        source: "categories",
      },
      {
        key: "duration_minutes",
        label: "Durată (minute)",
        kind: "number",
        required: true,
        min: 5,
        max: 1440,
        defaultValue: 30,
      },
      {
        key: "price",
        label: "Preț (RON)",
        kind: "number",
        step: "0.01",
        min: 0,
        max: 99999999,
      },
      {
        key: "buffer_before",
        label: "Buffer înainte (minute)",
        kind: "number",
        required: true,
        min: 0,
        max: 240,
        defaultValue: 0,
      },
      {
        key: "buffer_after",
        label: "Buffer după (minute)",
        kind: "number",
        required: true,
        min: 0,
        max: 240,
        defaultValue: 0,
      },
      {
        key: "doctor_requirement",
        label: "Cerință medic",
        kind: "select",
        options: [
          ["required", "Medic obligatoriu"],
          ["optional", "Medic opțional"],
          ["none", "Fără medic"],
        ],
      },
      {
        key: "room_required",
        label: "Cabinet obligatoriu",
        kind: "select",
        options: [
          ["true", "Da"],
          ["false", "Nu"],
        ],
      },
      {
        key: "minimum_room_capacity",
        label: "Capacitate minimă cabinet",
        kind: "number",
        required: true,
        min: 1,
        max: 100,
        defaultValue: 1,
      },
      {
        key: "doctor_ids",
        label: "Medici eligibili",
        kind: "multiple",
        source: "doctors",
      },
      {
        key: "room_ids",
        label: "Cabinete eligibile",
        kind: "multiple",
        source: "rooms",
      },
      {
        key: "equipment_ids",
        label: "Echipamente necesare",
        kind: "multiple",
        source: "equipment",
        hint: "Fiecare echipament selectat este obligatoriu. Motorul verifică programul, capacitatea și amplasarea.",
      },
      {
        key: "instructions",
        label: "Instrucțiuni de pregătire",
        kind: "textarea",
        max: 10000,
      },
      {
        key: "required_documents",
        label: "Documente necesare",
        kind: "lines",
        hint: "Un document pe linie; maximum 50.",
      },
      {
        key: "exclusion_rules",
        label: "Avertismente / reguli de excludere",
        kind: "lines",
        hint: "O regulă pe linie. Informații configurabile, fără decizie medicală automată.",
      },
    ],
  },
  availability: {
    title: "Program de lucru",
    singular: "Interval de lucru",
    description: "Intervale săptămânale și pauze, în fusul orar al clinicii.",
    permission: "availability",
    columns: [
      ["name", "Interval"],
      ["resource_kind", "Resursă"],
      ["resource_name", "Nume resursă"],
      ["weekday", "Zi"],
      ["start_time", "De la"],
      ["end_time", "Până la"],
      ["interval_kind", "Tip"],
    ],
    fields: [
      { ...name, label: "Denumire interval" },
      ...resource,
      {
        key: "weekday",
        label: "Ziua săptămânii",
        kind: "select",
        options: [
          ["1", "Luni"],
          ["2", "Marți"],
          ["3", "Miercuri"],
          ["4", "Joi"],
          ["5", "Vineri"],
          ["6", "Sâmbătă"],
          ["7", "Duminică"],
        ],
      },
      {
        key: "start_time",
        label: "Ora de început",
        kind: "time",
        required: true,
      },
      {
        key: "end_time",
        label: "Ora de sfârșit",
        kind: "time",
        required: true,
      },
      { key: "valid_from", label: "Valabil din", kind: "date", required: true },
      { key: "valid_until", label: "Valabil până la", kind: "date" },
      {
        key: "interval_kind",
        label: "Tip interval",
        kind: "select",
        options: [
          ["work", "Program de lucru"],
          ["break", "Pauză"],
        ],
      },
    ],
  },
  exceptions: {
    title: "Blocări și excepții",
    singular: "Excepție",
    description: "Concedii, sărbători, mentenanță și program excepțional.",
    permission: "availability",
    columns: [
      ["name", "Denumire"],
      ["resource_kind", "Resursă"],
      ["resource_name", "Nume resursă"],
      ["exception_kind", "Tip"],
      ["starts_at", "Început"],
      ["ends_at", "Sfârșit"],
    ],
    fields: [
      name,
      ...resource,
      {
        key: "starts_at",
        label: "Început",
        kind: "datetime",
        required: true,
        hint: "Data și ora locală a clinicii.",
      },
      { key: "ends_at", label: "Sfârșit", kind: "datetime", required: true },
      {
        key: "exception_kind",
        label: "Tip excepție",
        kind: "select",
        options: [
          ["closed", "Indisponibil"],
          ["holiday", "Sărbătoare"],
          ["leave", "Concediu"],
          ["maintenance", "Mentenanță"],
          ["meeting", "Ședință"],
          ["manual", "Blocare manuală"],
          ["extra_work", "Program suplimentar"],
        ],
      },
      {
        key: "notes",
        label: "Detalii administrative",
        kind: "textarea",
        max: 2000,
      },
    ],
  },
};
export function modulePermission(
  module: CoreModule,
  mode: "read" | "manage",
): Permission {
  return `${moduleSpecs[module].permission}.${mode}`;
}
export const coreRowSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    active: z.boolean(),
    archived_at: z.string().nullable(),
    updated_at: z.string(),
  })
  .catchall(z.json());
export type CoreRow = z.infer<typeof coreRowSchema>;
export const listResultSchema = z.object({
  items: z.array(coreRowSchema),
  total: z.number().int().nonnegative(),
});
export const listInputSchema = z.object({
  query: z.string().trim().max(100).default(""),
  state: z.enum(["active", "inactive", "all", "archived"]).default("active"),
  sort_key: z.enum(["name", "created_at", "updated_at"]).default("name"),
  descending: z.boolean().default(false),
  page_number: z.number().int().min(1).max(100000).default(1),
  filter_id: z.uuid().nullable().default(null),
});
export type ListInput = z.infer<typeof listInputSchema>;
export const optionSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  active: z.boolean(),
});
export type Option = z.infer<typeof optionSchema>;
export function valueText(row: CoreRow | undefined, key: string) {
  const value = row?.[key];
  return value == null
    ? ""
    : typeof value === "string" || typeof value === "number"
      ? String(value)
      : "";
}
export function valueIds(row: CoreRow | undefined, key: string): string[] {
  const value = row?.[key];
  return Array.isArray(value)
    ? value.filter((x): x is string => typeof x === "string")
    : [];
}
