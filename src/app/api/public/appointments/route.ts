import { NextResponse } from "next/server";
import { publicServerDb } from "@/lib/supabase/public-server";
import { requestFingerprint } from "@/lib/request-fingerprint";
import { publicBookingSchema } from "@/features/public-booking/model";
import { hasAdminConfig } from "@/lib/supabase/admin";
import { issueSystemConfirmation } from "@/features/confirmations/service";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request) || !request.headers.get("content-type")?.includes("application/json"))
    return NextResponse.json({ error: "Cerere invalidă." }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Cerere invalidă." }, { status: 400 }); }
  const input = publicBookingSchema.safeParse(body);
  if (!input.success || input.data.website || Date.now() - input.data.started_at < 300)
    return NextResponse.json({ error: "Verificați datele introduse." }, { status: 400 });
  const { clinic, consent: _consent, website: _website, started_at: _startedAt, ...payload } = input.data;
  void _consent; void _website; void _startedAt;
  const { data, error } = await publicServerDb().rpc("create_public_booking", {
    slug: clinic,
    payload,
    request_key: requestFingerprint(request),
  });
  if (error) {
    const limited = error.message.includes("Rate limit");
    return NextResponse.json({ error: limited ? "Prea multe încercări. Reîncercați mai târziu." : "Programarea nu a putut fi înregistrată. Verificați datele și încercați din nou." }, { status: limited ? 429 : 400 });
  }
  const result = data as { ok?: boolean; appointment_id?: string; start_at?: string; end_at?: string };
  if (!result.ok) return NextResponse.json({ error: "Intervalul nu mai este disponibil. Alegeți o altă oră." }, { status: 409 });
  if (result.appointment_id && hasAdminConfig()) {
    await issueSystemConfirmation(clinic, result.appointment_id).catch(() => undefined);
  }
  return NextResponse.json({ ok: true, appointment_id: result.appointment_id, start_at: result.start_at, end_at: result.end_at }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
