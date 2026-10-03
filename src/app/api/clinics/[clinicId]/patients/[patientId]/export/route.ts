import { z } from "zod";
import { requireClinic } from "@/features/auth/access";
export async function GET(_: Request, { params }: { params: Promise<{ clinicId: string; patientId: string }> }) {
  const { clinicId, patientId } = await params;
  const { client } = await requireClinic(clinicId,"organization.manage");
  if (!z.uuid().safeParse(patientId).success) return Response.json({ error: "Pacient indisponibil." },{ status:404 });
  const { data,error } = await client.rpc("export_patient",{ cid:clinicId,pid:patientId });
  if (error) return Response.json({ error:"Exportul nu a putut fi generat." },{ status:403,headers:{"Cache-Control":"private, no-store"} });
  return Response.json(data,{headers:{"Content-Disposition":`attachment; filename="patient-${patientId}.json"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
