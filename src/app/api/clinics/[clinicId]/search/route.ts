import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClinic } from "@/features/auth/access";

const schema = z.object({ query: z.string().trim().min(2).max(80) }).strict();

export async function POST(request: Request, context: { params: Promise<{clinicId:string}> }) {
  const { clinicId } = await context.params;
  if (!z.uuid().safeParse(clinicId).success) return NextResponse.json({error:"Cerere invalidă."},{status:400});
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({error:"Cerere invalidă."},{status:400}); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({error:"Introduceți cel puțin două caractere."},{status:400});
  const { client } = await requireClinic(clinicId);
  const { data, error } = await client.rpc("global_search", { cid:clinicId, search_query:parsed.data.query, result_limit:30 });
  if (error) return NextResponse.json({error:"Căutarea nu este disponibilă momentan."},{status:500});
  return NextResponse.json({results:data},{headers:{"Cache-Control":"private, no-store"}});
}
