import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { processNotifications } from "@/features/notifications/worker";

export const maxDuration = 60;

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  const actual = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected) return false;
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}
async function run(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  if (process.env.NOTIFICATION_DELIVERY_ENABLED !== "true" && (process.env.APP_ENVIRONMENT === "production" || process.env.VERCEL_ENV === "production"))
    return NextResponse.json({ error: "Trimiterea automată nu este activată." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const origin = process.env.APP_ORIGIN ?? new URL(request.url).origin;
  return NextResponse.json(await processNotifications(origin));
}
export const GET = run;
export const POST = run;
