import { NextResponse } from "next/server";
import { z } from "zod";
import { publicCatalog, publicClinics } from "@/features/public-booking/data";

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("clinic");
  if (!slug) return NextResponse.json(await publicClinics(), { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
  if (!z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80).safeParse(slug).success)
    return NextResponse.json({ error: "Locație invalidă." }, { status: 400 });
  const catalog = await publicCatalog(slug);
  if (!catalog) return NextResponse.json({ error: "Locația nu este disponibilă." }, { status: 404 });
  return NextResponse.json(catalog, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
}
