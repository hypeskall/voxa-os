import { z } from "zod";
export const importRow = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Numele trebuie să conțină cel puțin 2 caractere.")
      .max(160),
    internal_id: z
      .string()
      .trim()
      .min(1, "Codul intern este obligatoriu.")
      .max(50),
    email: z.union([z.email(), z.literal("")]).default(""),
    phone: z.string().trim().max(40).default(""),
    birth_date: z.union([z.iso.date(), z.literal("")]).default(""),
  })
  .refine(
    (r) =>
      !r.birth_date ||
      (r.birth_date >= "1900-01-01" &&
        r.birth_date <= new Date().toISOString().slice(0, 10)),
    { path: ["birth_date"], message: "Data nașterii nu este validă." },
  );
export const importRows = z.array(importRow).min(1).max(500);
export type ImportRow = z.infer<typeof importRow>;
export const importReport = z.object({
  created: z.number(),
  skipped: z.number(),
  rows: z.array(
    z.object({ row: z.number(), status: z.enum(["NEW", "DUPLICATE"]) }),
  ),
  preview: z.boolean(),
});
export const importHeaders = [
  "name",
  "internal_id",
  "birth_date",
  "phone",
  "email",
] as const;
