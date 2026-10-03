import { NextResponse } from "next/server";
import { db } from "@/lib/supabase/server";
import { authCallbackInput } from "@/features/auth/callback-model";
import { appOrigin } from "@/lib/app-origin";
export async function GET(request: Request) {
  const input = authCallbackInput(new URL(request.url).searchParams);
  // A GET from an email scanner must not consume a one-use recovery token.
  if (input.kind === "email" && input.type === "recovery") {
    const target = new URL("/auth/recovery", appOrigin());
    target.searchParams.set("token_hash", input.token_hash);
    const response = NextResponse.redirect(target);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }
  let succeeded = false;
  if (input.kind !== "invalid") {
    const client = await db();
    const { error } = input.kind === "pkce"
      ? await client.auth.exchangeCodeForSession(input.code)
      : await client.auth.verifyOtp({ token_hash: input.token_hash, type: input.type });
    succeeded = !error;
  }
  const target = succeeded ? (input.next === "/" ? "/dashboard" : input.next) : input.next === "/portal" ? "/portal/login?error=link" : "/login?error=link";
  const response = NextResponse.redirect(new URL(target, appOrigin()));
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
