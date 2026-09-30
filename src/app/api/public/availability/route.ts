import { NextResponse } from "next/server";
import { z } from "zod";
import { publicServerDb } from "@/lib/supabase/public-server";
import { requestFingerprint } from "@/lib/request-fingerprint";
import { publicAvailabilityQuerySchema, publicSlotSchema } from "@/features/public-booking/model";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const input = publicAvailabilityQuerySchema.safeParse({
    clinic: url.searchParams.get("clinic") ?? "",
    service: url.searchParams.get("service") ?? "",
    doctor: url.searchParams.get("doctor") ?? "",
    date: url.searchParams.get("date") ?? "",
  });
  if (!input.success) return NextResponse.json({ error: "Cerere invalidă." }, { status: 400 });
  const { data, error } = await publicServerDb().rpc("public_available_slots", {
    slug: input.data.clinic,
    sid: input.data.service,
    day: input.data.date,
    doctor_id: input.data.doctor || null,
    request_key: requestFingerprint(request),
  });
  if (error) {
    const limited = error.message.includes("Rate limit");
    return NextResponse.json({ error: limited ? "Prea multe cereri. Reîncercați în câteva minute." : "Disponibilitatea nu poate fi verificată momentan." }, { status: limited ? 429 : 400 });
  }
  return NextResponse.json(z.array(publicSlotSchema).parse(data), { headers: { "Cache-Control": "no-store, max-age=0" } });
}

