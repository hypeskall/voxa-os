import { NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { error } = await adminDb().from("organization_subscriptions").select("id").limit(1).abortSignal(AbortSignal.timeout(5000));
    if (error) throw new Error("Database unavailable");
    return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "60" } });
  }
}
