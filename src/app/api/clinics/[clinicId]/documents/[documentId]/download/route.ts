import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/supabase/server";
import { MEDICAL_BUCKET } from "@/lib/medical-storage";
import { medicalDownloadResponse } from "@/lib/medical-download";

const authorizationSchema = z.object({ path: z.string(), file_name: z.string(), mime_type: z.string() });
export async function GET(_: Request, { params }: { params: Promise<{ clinicId: string; documentId: string }> }) {
  const parsed = z.object({ clinicId: z.uuid(), documentId: z.uuid() }).safeParse(await params);
  if (!parsed.success) return new NextResponse("Negăsit", { status: 404 });
  const client = await db();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return new NextResponse("Neautorizat", { status: 401 });
  const { data, error } = await client.rpc("authorize_document_download", { cid: parsed.data.clinicId, document_id: parsed.data.documentId });
  const access = authorizationSchema.safeParse(data);
  if (error || !access.success) return new NextResponse("Acces refuzat", { status: 403 });
  const { data: file, error: downloadError } = await client.storage.from(MEDICAL_BUCKET).download(access.data.path);
  if (downloadError || !file) return new NextResponse("Fișier indisponibil", { status: 404 });
  try { return await medicalDownloadResponse(file, access.data.path, access.data.file_name, access.data.mime_type); }
  catch { return new NextResponse("Fișier indisponibil", { status: 404, headers: { "Cache-Control": "private, no-store" } }); }
}
