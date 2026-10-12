import { NextResponse } from "next/server";
import { db } from "@/lib/supabase/server";
import { appOrigin } from "@/lib/app-origin";
export async function GET() {
  const client = await db();
  await client.auth.signOut({ scope: "local" });
  const response = NextResponse.redirect(new URL("/login?expired=1", appOrigin()));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
