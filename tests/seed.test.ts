import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { migratedDatabase } from "./support/database";
it("applies the development core seed through authenticated production workflows", async () => {
  const db = await migratedDatabase();
  try {
    await db.exec(readFileSync("supabase/seed-core.sql", "utf8"));
    expect(
      (await db.query("select id from public.patients")).rows,
    ).toHaveLength(31);
    expect(
      (await db.query("select id from public.doctor_locations")).rows,
    ).toHaveLength(2);
    expect(
      (await db.query("select id from public.availability_rules")).rows,
    ).toHaveLength(20);
    expect(
      (await db.query("select id from public.schedule_exceptions")).rows,
    ).toHaveLength(2);
  } finally {
    await db.close();
  }
});
