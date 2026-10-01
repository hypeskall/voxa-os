import "server-only";
import { z } from "zod";
import { requireClinic } from "@/features/auth/access";

const countRow = z.object({ label: z.string(), count: z.number() });
const namedRow = z.object({ name: z.string(), count: z.number() });
const reportSchema = z.object({
  from: z.string(), to: z.string(),
  summary: z.object({ total: z.number(), cancelled: z.number(), no_show: z.number(), completed: z.number(), occupancy_percent: z.number().nullable() }),
  by_status: z.array(countRow), by_source: z.array(countRow),
  by_doctor: z.array(namedRow), by_service: z.array(namedRow),
  resources: z.array(z.object({ kind: z.enum(["room", "equipment"]), name: z.string(), appointment_count: z.number(), booked_minutes: z.number() })),
});
export type ReportData = z.infer<typeof reportSchema>;

export const reportFiltersSchema = z.object({
  from: z.iso.date(), to: z.iso.date(),
  doctor: z.uuid().optional(), service: z.uuid().optional(),
}).refine((v) => v.to >= v.from && (new Date(v.to).getTime()-new Date(v.from).getTime())/86400000 <= 366);

export async function loadReport(clinicId: string, filters: z.infer<typeof reportFiltersSchema>) {
  const { client } = await requireClinic(clinicId, "reports.read");
  const { data, error } = await client.rpc("reports_summary", {
    cid: clinicId, date_from: filters.from, date_to: filters.to,
    doctor_filter: filters.doctor ?? null, service_filter: filters.service ?? null,
  });
  if (error) throw new Error("Raportul nu a putut fi generat.");
  const parsed = reportSchema.safeParse(data);
  if (!parsed.success) throw new Error("Răspuns invalid pentru raport.");
  return parsed.data;
}

function csvCell(value: string | number | null) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function reportToCsv(report: ReportData) {
  const lines: (string | number | null)[][] = [
    ["Raport operațional Voxa"], ["De la", report.from], ["Până la", report.to], [],
    ["Indicator", "Valoare"], ["Programări", report.summary.total], ["Finalizate", report.summary.completed],
    ["Anulate", report.summary.cancelled], ["Neprezentări", report.summary.no_show], ["Ocupare program (%)", report.summary.occupancy_percent], [],
    ["Status", "Programări"], ...report.by_status.map((r) => [r.label, r.count]), [],
    ["Sursă", "Programări"], ...report.by_source.map((r) => [r.label, r.count]), [],
    ["Medic", "Programări"], ...report.by_doctor.map((r) => [r.name, r.count]), [],
    ["Serviciu", "Programări"], ...report.by_service.map((r) => [r.name, r.count]), [],
    ["Tip resursă", "Resursă", "Programări", "Minute ocupate"], ...report.resources.map((r) => [r.kind, r.name, r.appointment_count, r.booked_minutes]),
  ];
  return "\uFEFF" + lines.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
