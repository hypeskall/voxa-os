import { db } from "@/lib/supabase/server";
import { sessionStatus } from "@/features/auth/session";
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return Response.json({ error: "Cerere invalidă." }, { status: 403 });
  const client = await db();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return Response.json({ allowed: false, reason: "unauthenticated" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  const input = await request.json().catch(() => null);
  const status = await sessionStatus(client, input?.activity === true);
  return Response.json(status, { status: status.allowed ? 200 : 401, headers: { "Cache-Control": "private, no-store" } });
}
