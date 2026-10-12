import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { cookieOptions } from "@/lib/supabase/config";
import { assertDeploymentTarget } from "@/lib/deployment-target";
export async function proxy(request: NextRequest) {
  if (process.env.PATIENT_ENCRYPTION_MAINTENANCE === "true") {
    return new NextResponse("Actualizare de securitate în curs. Te rugăm să revii în câteva minute.", {
      status: 503,
      headers: { "Cache-Control": "private, no-store", "Retry-After": "120" },
    });
  }
  assertDeploymentTarget(process.env.APP_ENVIRONMENT, process.env.STAGING_SUPABASE_PROJECT_REF, process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.APP_ORIGIN);
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;
  const client = createServerClient(url, key, {
    cookieOptions,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, { ...options, ...cookieOptions }),
        );
      },
    },
  });
  // Refresh and verify the token here. Protected pages still fetch the current
  // user/factors from Auth; duplicating that remote lookup in Proxy adds latency.
  const { data } = await client.auth.getClaims();
  const protectedPath = /^\/(clinics|dashboard|account|onboarding|organizations|portal)(\/|$)/.test(request.nextUrl.pathname)
    && request.nextUrl.pathname !== "/portal/login"
    || request.nextUrl.pathname.startsWith("/api/clinics/");
  if (data?.claims && protectedPath) {
    const state = await client.rpc("session_status", { activity: false });
    if (state.error || state.data?.allowed !== true) {
      const denied = request.nextUrl.pathname.startsWith("/api/")
        ? NextResponse.json({ error: "Sesiunea a expirat. Conectați-vă din nou." }, { status: 401 })
        : NextResponse.redirect(new URL("/auth/locked", request.url), request.method === "POST" ? 303 : 307);
      denied.headers.set("Cache-Control", "private, no-store");
      response.cookies.getAll().forEach(cookie => denied.cookies.set(cookie));
      return denied;
    }
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|product/|fonts/).*)"],
};
