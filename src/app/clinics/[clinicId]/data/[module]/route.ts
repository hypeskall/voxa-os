import { NextResponse } from "next/server";
import { z } from "zod";
import { moduleSchema, listInputSchema } from "@/features/core-clinic/model";
import { listCore, optionsFor } from "@/features/core-clinic/data";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clinicId: string; module: string }> },
) {
  const { clinicId, module: raw } = await params;
  const moduleKey = moduleSchema.safeParse(raw);
  if (!moduleKey.success)
    return NextResponse.json({ error: "Modul invalid." }, { status: 404 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Date invalide." }, { status: 400 });
  }
  const parsed = listInputSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Filtre invalide." }, { status: 400 });
  const data = await listCore(clinicId, moduleKey.data, parsed.data);
  // Only columns needed by the table leave the server; never transmit notes,
  // addresses, preparation rules or patient history in a registry response.
  const columns = [
    "id",
    "name",
    "active",
    "archived_at",
    "updated_at",
    "internal_id",
    "phone",
    "email",
    "professional_code",
    "description",
    "type",
    "capacity",
    "duration_minutes",
    "price",
    "buffer_before",
    "buffer_after",
    "resource_kind",
    "resource_name",
    "weekday",
    "start_time",
    "end_time",
    "interval_kind",
    "starts_at",
    "ends_at",
    "exception_kind",
  ];
  return NextResponse.json(
    {
      ...data,
      items: data.items.map((row) =>
        Object.fromEntries(
          columns.filter((k) => k in row).map((k) => [k, row[k]]),
        ),
      ),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ clinicId: string; module: string }> },
) {
  const { clinicId, module: raw } = await params;
  const moduleKey = moduleSchema.safeParse(raw);
  const url = new URL(request.url);
  const input = z
    .object({
      query: z.string().max(100),
      selected: z.array(z.uuid()).max(200),
    })
    .safeParse({
      query: url.searchParams.get("q") ?? "",
      selected: url.searchParams.getAll("selected"),
    });
  if (
    !moduleKey.success ||
    !input.success ||
    ["patients", "availability", "exceptions"].includes(raw)
  )
    return NextResponse.json({ error: "Cerere invalidă." }, { status: 400 });
  return NextResponse.json(
    await optionsFor(
      clinicId,
      moduleKey.data,
      input.data.selected,
      input.data.query,
    ),
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

