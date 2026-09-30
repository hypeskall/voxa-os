import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { processNotifications } from "@/features/notifications/worker";

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  const actual = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || actual.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
async function run(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  const origin = process.env.APP_ORIGIN ?? new URL(request.url).origin;
  return NextResponse.json(await processNotifications(origin));
}
export const GET = run;
export const POST = run;
