import { NextResponse } from "next/server";
import { z } from "zod";
import { publicServerDb } from "@/lib/supabase/public-server";
import { requestFingerprint } from "@/lib/request-fingerprint";
import { tokenDigest, validTokenShape } from "@/features/confirmations/token";

const schema = z.object({ token: z.string().max(300), action: z.enum(["confirm", "cancel"]) });
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    try { if (new URL(origin).host !== request.headers.get("host")) return NextResponse.json({ error: "Cerere invalidă." }, { status: 400 }); }
    catch { return NextResponse.json({ error: "Cerere invalidă." }, { status: 400 }); }
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !validTokenShape(parsed.data.token)) return NextResponse.json({ error: "Link invalid sau expirat." }, { status: 400 });
  const { data, error } = await publicServerDb().rpc("public_confirmation_action", {
    token_digest: tokenDigest(parsed.data.token), action_value: parsed.data.action, request_key: requestFingerprint(request),
  });
  if (error) return NextResponse.json({ error: error.message.includes("Cancellation") ? "Programarea nu mai poate fi anulată online. Contactați clinica." : "Link invalid, expirat sau revocat." }, { status: 400 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
