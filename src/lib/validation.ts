import { z } from "zod";
export const loginSchema = z.object({
  identifier: z.string().trim().toLowerCase().pipe(z.union([
    z.email().max(254),
    z.string().min(3).max(32).regex(/^[a-z][a-z0-9._-]*$/),
  ])),
  password: z.string().min(1).max(128),
});
export const clinicSchema = z.object({
  name: z.string().trim().min(2).max(100),
  address: z.string().trim().max(250),
  phone: z.string().trim().max(40).default(""),
  phone_secondary: z.string().trim().max(40).default(""),
  email: z.union([z.email().max(254), z.literal("")]).default(""),
  timezone: z.enum(["Europe/Bucharest", "Europe/London", "Europe/Paris"]),
  public_booking_enabled: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  booking_slug: z
    .string()
    .trim()
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Adresă publică invalidă.")
    .or(z.literal(""))
    .default("")
    .transform((value) => value || null),
  scheduling_increment_minutes: z.coerce.number().int().min(5).max(120).default(15),
  calendar_visible_start: z.iso.time().default("08:00:00"),
  calendar_visible_end: z.iso.time().default("20:00:00"),
  whatsapp_reminder_template: z.string().trim().min(20).max(4000),
}).refine((value) => value.calendar_visible_end > value.calendar_visible_start, {
  path: ["calendar_visible_end"],
  message: "Ora finală trebuie să fie după ora de început.",
});
export const organizationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  clinicName: z.string().trim().min(2).max(100),
});
export const preferencesSchema = z.object({
  density: z.enum(["compact", "comfortable"]),
  calendar_view: z.enum(["day", "week", "month", "agenda"]).default("week"),
  default_clinic_id: z
    .union([z.uuid(), z.literal("")])
    .transform((v) => v || null),
  patient_columns: z.array(z.enum(["internal_id", "phone", "email"])).max(3).default(["internal_id","phone","email"]),
  dashboard_modules: z.array(z.enum(["metrics", "upcoming", "alerts", "activity"])).min(1).max(4).default(["metrics","upcoming","alerts","activity"]),
});
