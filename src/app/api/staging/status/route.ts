import { assertDeploymentTarget } from "@/lib/deployment-target";
export async function GET() {
  if (process.env.APP_ENVIRONMENT !== "staging") return new Response(null, { status: 404 });
  assertDeploymentTarget(process.env.APP_ENVIRONMENT, process.env.STAGING_SUPABASE_PROJECT_REF, process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.APP_ORIGIN);
  return Response.json({ environment: "staging", supabaseProjectRef: process.env.STAGING_SUPABASE_PROJECT_REF, origin: process.env.APP_ORIGIN }, { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
