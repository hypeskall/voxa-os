import { beforeAll, afterAll, describe, it, expect } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { migratedDatabase, callerQuery, ids } from "./support/database";
import {
  localToInstant,
  instantToLocal,
  parseCore,
} from "../src/features/core-clinic/validation";
let db: PGlite;
beforeAll(async () => {
  db = await migratedDatabase();
});
afterAll(async () => {
  await db.close();
});
const query = <T>(sql: string, args: unknown[] = [], uid = ids.owner) =>
  callerQuery<T>(db, uid, sql, args);
async function save(
  mod: string,
  payload: object,
  cid = ids.a,
  id: string | null = null,
  version: string | null = null,
  uid = ids.owner,
) {
  const result =
    mod === "doctors"
      ? await query<{ id: string }>(
          "select public.save_doctor($1,$2,$3,$4) id",
          [cid, id, payload, version],
          uid,
        )
      : await query<{ id: string }>(
          "select public.save_core($1,$2,$3,$4,$5) id",
          [cid, mod, id, payload, version],
          uid,
        );
  return result.rows[0].id;
}
async function read(mod: string, id: string, cid = ids.a, uid = ids.owner) {
  return (
    await query<{ r: Record<string, unknown> }>(
      "select public.read_core($1,$2,$3) r",
      [cid, mod, id],
      uid,
    )
  ).rows[0].r;
}
const fixtures = {
  patients: {
    name: "Test patient",
    internal_id: "PAT-001",
    email: "patient@test.local",
    administrative_notes: "PRIVATE NOTES",
  },
  specialities: { name: "Cardiologie" },
  categories: { name: "Consultații" },
  rooms: { name: "Cabinet 1", capacity: 2 },
  equipment: { name: "Aparat configurabil", internal_id: "EQ-1" },
  services: {
    name: "Evaluare configurabilă",
    duration_minutes: 30,
    price: 120.5,
    buffer_before: 5,
    buffer_after: 10,
    required_documents: ["Act identitate"],
    exclusion_rules: ["Evaluare prealabilă"],
  },
  doctors: { name: "Doctor exemplu", professional_code: "DOC-1" },
  availability: {
    name: "Program luni",
    resource_kind: "clinic",
    weekday: 1,
    start_time: "08:00",
    end_time: "16:00",
    valid_from: "2026-01-01",
  },
  exceptions: {
    name: "Închidere sărbătoare",
    resource_kind: "clinic",
    starts_at: "2026-12-25T00:00:00+02:00",
    ends_at: "2026-12-26T00:00:00+02:00",
    exception_kind: "holiday",
  },
};
const entities: Record<string, string> = {};
describe("Phase 2 workflows on real PostgreSQL", () => {
  it.each(Object.entries(fixtures))(
    "creates, reads, edits, archives and restores %s",
    async (mod, payload) => {
      const id = await save(mod, payload);
      entities[mod] = id;
      const created = await read(mod, id);
      expect(created.name).toBe(payload.name);
      await save(
        mod,
        { ...payload, name: payload.name + " editat" },
        ids.a,
        id,
        String(created.updated_at),
      );
      const edited = await read(mod, id);
      expect(edited.name).toContain("editat");
      await query("select public.archive_core($1,$2,$3)", [ids.a, mod, id]);
      expect((await read(mod, id)).archived_at).not.toBeNull();
      await query("select public.archive_core($1,$2,$3,true)", [
        ids.a,
        mod,
        id,
      ]);
      expect((await read(mod, id)).active).toBe(true);
    },
  );
  it("persists relations in both directions and fixed equipment room", async () => {
    const service = await read("services", entities.services);
    await save(
      "services",
      {
        ...fixtures.services,
        category_id: entities.categories,
        doctor_ids: [entities.doctors],
        room_ids: [entities.rooms],
        equipment_ids: [entities.equipment],
      },
      ids.a,
      entities.services,
      String(service.updated_at),
    );
    expect((await read("doctors", entities.doctors)).service_ids).toEqual([
      entities.services,
    ]);
    const doctor = await read("doctors", entities.doctors);
    await save(
      "doctors",
      {
        ...fixtures.doctors,
        speciality_ids: [entities.specialities],
        room_ids: [entities.rooms],
        service_ids: [entities.services],
      },
      ids.a,
      entities.doctors,
      String(doctor.updated_at),
    );
    expect((await read("services", entities.services)).doctor_ids).toEqual([
      entities.doctors,
    ]);
    const eq = await read("equipment", entities.equipment);
    await save(
      "equipment",
      { room_id: entities.rooms },
      ids.a,
      entities.equipment,
      String(eq.updated_at),
    );
    expect((await read("equipment", entities.equipment)).room_id).toBe(
      entities.rooms,
    );
  });
  it("invalidates stale editors when relations change from the other side", async () => {
    const service = await read("services", entities.services);
    const doctor = await read("doctors", entities.doctors);
    await save(
      "doctors",
      { ...fixtures.doctors, service_ids: [] },
      ids.a,
      entities.doctors,
      String(doctor.updated_at),
    );
    await expect(
      save(
        "services",
        { doctor_ids: [entities.doctors], name: "Stale relation" },
        ids.a,
        entities.services,
        String(service.updated_at),
      ),
    ).rejects.toThrow("Stale version");
    const fresh = await read("services", entities.services);
    await save(
      "services",
      { name: String(fresh.name), doctor_ids: [entities.doctors] },
      ids.a,
      entities.services,
      String(fresh.updated_at),
    );
  });
  it("shares doctor identity across locations without copying local configuration", async () => {
    const { rows } = await query<{ id: string }>(
      "select public.attach_doctor($1,$2,$3) id",
      [ids.a, entities.doctors, ids.b],
    );
    const second = await read("doctors", rows[0].id, ids.b);
    expect(second.doctor_id).toBe(
      (await read("doctors", entities.doctors)).doctor_id,
    );
    expect(second.service_ids).toEqual([]);
    expect((await read("doctors", entities.doctors)).locations).toHaveLength(2);
    const current = await read("doctors", entities.doctors);
    await expect(
      save(
        "doctors",
        { ...fixtures.doctors, name: "Forbidden shared edit" },
        ids.a,
        entities.doctors,
        String(current.updated_at),
        ids.admin,
      ),
    ).rejects.toThrow("all doctor locations");
    await expect(
      query(
        "select public.attach_doctor($1,$2,$3)",
        [ids.a, entities.doctors, ids.b],
        ids.admin,
      ),
    ).rejects.toThrow("Access denied");
    await expect(
      query("select public.attach_doctor($1,$2,$3)", [
        ids.a,
        entities.doctors,
        ids.c,
      ]),
    ).rejects.toThrow("Access denied");
  });
  it("blocks Clinic A users from reading or mutating Clinic B and C through SQL and RPC", async () => {
    const bPatient = await save(
      "patients",
      { name: "Clinic B secret", internal_id: "PAT-B" },
      ids.b,
    );
    expect(
      (
        await query(
          "select * from public.patients where clinic_id=$1",
          [ids.b],
          ids.reception,
        )
      ).rows,
    ).toEqual([]);
    expect(
      (
        await query(
          "update public.patients set name='Intrusion' where id=$1 returning id",
          [bPatient],
          ids.reception,
        )
      ).rows,
    ).toEqual([]);
    expect(await read("patients", bPatient, ids.a, ids.reception)).toBeNull();
    await expect(
      read("patients", bPatient, ids.b, ids.reception),
    ).rejects.toThrow("Access denied");
    await expect(
      save(
        "patients",
        { name: "Intrusion", internal_id: "bad" },
        ids.b,
        null,
        null,
        ids.reception,
      ),
    ).rejects.toThrow("Access denied");
    await expect(
      query(
        "select public.patient_history($1,$2)",
        [ids.b, bPatient],
        ids.reception,
      ),
    ).rejects.toThrow("Access denied");
    await expect(
      query("select public.list_core($1,'patients')", [ids.c]),
    ).rejects.toThrow("Access denied");
  });
  it("enforces least privilege and blocks identifier retargeting and hard deletion", async () => {
    await save(
      "patients",
      { name: "Reception patient", internal_id: "REC-1" },
      ids.a,
      null,
      null,
      ids.reception,
    );
    await expect(
      save("rooms", { name: "Forbidden" }, ids.a, null, null, ids.reception),
    ).rejects.toThrow("Access denied");
    await expect(
      query("select public.list_core($1,'patients')", [ids.a], ids.doctor),
    ).rejects.toThrow("Access denied");
    await expect(
      query("update public.patients set clinic_id=$1 where id=$2", [
        ids.b,
        entities.patients,
      ]),
    ).rejects.toThrow("Immutable tenant identity");
    await expect(
      query("delete from public.patients where id=$1", [entities.patients]),
    ).rejects.toThrow();
  });
  it("rejects foreign-clinic references and rolls back the whole save", async () => {
    const foreignRoom = await save("rooms", { name: "B Room" }, ids.b);
    const before = await read("services", entities.services);
    await expect(
      save(
        "services",
        { name: "Should rollback", room_ids: [foreignRoom] },
        ids.a,
        entities.services,
        String(before.updated_at),
      ),
    ).rejects.toThrow("Resource");
    expect((await read("services", entities.services)).name).toBe(before.name);
    expect((await read("services", entities.services)).room_ids).toEqual([
      entities.rooms,
    ]);
    await expect(
      save("equipment", {
        name: "Bad equipment",
        internal_id: "BAD",
        room_id: foreignRoom,
      }),
    ).rejects.toThrow();
    await expect(
      save("availability", {
        ...fixtures.availability,
        resource_kind: "room",
        room_id: foreignRoom,
      }),
    ).rejects.toThrow();
  });
  it("rejects stale edits and audits metadata without personal values", async () => {
    const before = await read("patients", entities.patients);
    await save(
      "patients",
      { address: "PRIVATE ADDRESS" },
      ids.a,
      entities.patients,
      String(before.updated_at),
    );
    await expect(
      save(
        "patients",
        { name: "Lost update" },
        ids.a,
        entities.patients,
        String(before.updated_at),
      ),
    ).rejects.toThrow("Stale version");
    const h = await query(
      "select public.patient_history($1,$2)",
      [ids.a, entities.patients],
      ids.reception,
    );
    expect(JSON.stringify(h.rows)).toContain("address");
    expect(JSON.stringify(h.rows)).not.toContain("PRIVATE");
  });
  it("filters, searches and paginates real rows in stable order", async () => {
    for (let i = 0; i < 28; i++)
      await save("patients", {
        name: `Page ${String(i).padStart(2, "0")}`,
        internal_id: `PAGE-${i}`,
        phone: `0777${i}`,
        email: `page${i}@test.local`,
      });
    const list = async (q: string, page = 1) =>
      (
        await query<{ r: { items: { name: string }[]; total: number } }>(
          "select public.list_core($1,'patients',$2,'active','name',false,$3) r",
          [ids.a, q, page],
        )
      ).rows[0].r;
    const first = await list("Page ");
    const second = await list("Page ", 2);
    expect(first.total).toBe(28);
    expect(first.items).toHaveLength(25);
    expect(second.items).toHaveLength(3);
    expect(first.items[0].name).toBe("Page 00");
    expect(second.items[0].name).toBe("Page 25");
    expect((await list("page27@test.local")).total).toBe(1);
    expect((await list("077727")).total).toBe(1);
    const filtered = await query<{ r: { total: number } }>(
      "select public.list_core($1,'services',filter_id=>$2) r",
      [ids.a, entities.categories],
    );
    expect(filtered.rows[0].r.total).toBe(1);
  });
  it("validates weekly overlaps, adjacent intervals, breaks and resources", async () => {
    await expect(
      save("availability", {
        ...fixtures.availability,
        name: "Overlap",
        start_time: "15:00",
        end_time: "18:00",
      }),
    ).rejects.toThrow();
    await save("availability", {
      ...fixtures.availability,
      name: "Adjacent",
      start_time: "16:00",
      end_time: "18:00",
    });
    await save("availability", {
      ...fixtures.availability,
      name: "Break",
      interval_kind: "break",
      start_time: "12:00",
      end_time: "12:30",
    });
    for (const [kind, key, ref] of [
      ["doctor", "doctor_location_id", entities.doctors],
      ["room", "room_id", entities.rooms],
      ["equipment", "equipment_id", entities.equipment],
    ]) {
      await save("availability", {
        ...fixtures.availability,
        name: `Work ${kind}`,
        resource_kind: kind,
        [key]: ref,
      });
      await save("exceptions", {
        ...fixtures.exceptions,
        name: `Block ${kind}`,
        resource_kind: kind,
        [key]: ref,
        exception_kind: kind === "equipment" ? "maintenance" : "leave",
      });
    }
    await expect(
      save("availability", { ...fixtures.availability, resource_kind: "room" }),
    ).rejects.toThrow();
    await expect(
      save("rooms", { name: "Invalid capacity", capacity: 0 }),
    ).rejects.toThrow();
    await expect(
      save("exceptions", {
        ...fixtures.exceptions,
        ends_at: "2026-01-01T00:00Z",
      }),
    ).rejects.toThrow();
  });
});
describe("Server validation and clinic timezone", () => {
  it("resolves winter and summer in clinic timezone and rejects DST gaps/folds", () => {
    expect(localToInstant("2026-01-15T09:00", "Europe/Bucharest")).toBe(
      "2026-01-15T07:00:00.000Z",
    );
    expect(localToInstant("2026-07-15T09:00", "Europe/Bucharest")).toBe(
      "2026-07-15T06:00:00.000Z",
    );
    expect(instantToLocal("2026-07-15T06:00Z", "Europe/Bucharest")).toBe(
      "2026-07-15T09:00",
    );
    expect(() =>
      localToInstant("2026-03-29T03:30", "Europe/Bucharest"),
    ).toThrow();
    expect(() =>
      localToInstant("2026-10-25T03:30", "Europe/Bucharest"),
    ).toThrow();
  });
  it("rejects malformed input and strips untrusted identity fields", () => {
    const f = new FormData();
    f.set("name", "Room");
    f.set("type", "");
    f.set("active", "true");
    f.set("capacity", "0");
    expect(() => parseCore("rooms", f, "Europe/Bucharest")).toThrow();
    f.set("capacity", "2");
    f.set("clinic_id", ids.b);
    expect(parseCore("rooms", f, "Europe/Bucharest")).toEqual({
      name: "Room",
      type: "",
      active: true,
      capacity: 2,
    });
  });
});
