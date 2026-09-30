import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClinic } from "@/features/auth/access";
import { loadReport, reportFiltersSchema, reportToCsv } from "@/features/reports/data";

export async function GET(request: Request, context: { params: Promise<{clinicId:string}> }) {
  const { clinicId } = await context.params;
  const url = new URL(request.url);
  const parsed = reportFiltersSchema.safeParse({ from:url.searchParams.get("from"), to:url.searchParams.get("to"), doctor:url.searchParams.get("doctor")||undefined, service:url.searchParams.get("service")||undefined });
  if (!z.uuid().safeParse(clinicId).success || !parsed.success) return NextResponse.json({error:"Filtre invalide."},{status:400});
  const { client } = await requireClinic(clinicId,"reports.read");
  const report = await loadReport(clinicId,parsed.data);
  const { error } = await client.rpc("record_report_export",{cid:clinicId,date_from:parsed.data.from,date_to:parsed.data.to});
  if (error) throw new Error("Exportul nu a putut fi înregistrat.");
  return new NextResponse(reportToCsv(report),{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="raport-${parsed.data.from}-${parsed.data.to}.csv"`,"Cache-Control":"private, no-store"}});
}
