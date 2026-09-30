import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { callerQuery, ids, migratedDatabase } from "./support/database";

type Result = {
  ok: boolean;
  appointment_id?: string;
  updated_at?: string;
  assignment?: { doctor_id: string | null; room_id: string | null };
  conflicts?: { code: string }[];
  warnings?: { code: string }[];
  requires_override?: boolean;
};
let db: PGlite;
const fixture: Record<string, string> = {};
const patients: string[] = [];

async function one<T>(sql: string, args: unknown[] = [], uid = ids.owner) {
  const { rows } = await callerQuery<{ value: T }>(db, uid, `select ${sql} value`, args);
  return rows[0].value;
}
async function create(
  patient: number,
  service: string,
  start: string,
  options: Record<string, unknown> = {},
  uid = ids.owner,
) {
  return one<Result>("public.create_appointment($1,$2)", [
    ids.a,
    {
      patient_id: patients[patient],
      service_id: fixture[service],
      start_at: start,
      equipment_ids: [],
      ...options,
    },
  ], uid);
}
function codes(result: Result) {
  return result.conflicts?.map((conflict) => conflict.code) ?? [];
}

beforeAll(async () => {
  db = await migratedDatabase();
  for (let index = 0; index < 30; index++) {
    const { rows } = await db.query<{ id: string }>(
      "insert into public.patients(organization_id,clinic_id,name,internal_id) values($1,$2,$3,$4) returning id",
      [ids.org, ids.a, `Patient ${index}`, `SCHED-${index}`],
    );
    patients.push(rows[0].id);
  }
  for (const name of ["doctor1", "doctor2"]) {
    const doctor = await db.query<{ id: string }>(
      "insert into public.doctors(organization_id,name,professional_code) values($1,$2,$3) returning id",
      [ids.org, name, `CODE-${name}`],
    );
    const location = await db.query<{ id: string }>(
      "insert into public.doctor_locations(organization_id,clinic_id,doctor_id) values($1,$2,$3) returning id",
      [ids.org, ids.a, doctor.rows[0].id],
    );
    fixture[name] = location.rows[0].id;
  }
  for (const [name, capacity] of [["room1", 1], ["room2", 1], ["capacityRoom", 2]] as const) {
    const { rows } = await db.query<{ id: string }>(
      "insert into public.rooms(organization_id,clinic_id,name,capacity) values($1,$2,$3,$4) returning id",
      [ids.org, ids.a, name, capacity],
    );
    fixture[name] = rows[0].id;
  }
  const equipment = await db.query<{ id: string }>(
    "insert into public.equipment(organization_id,clinic_id,name,internal_id,capacity) values($1,$2,'MRI 1','MRI-1',1) returning id",
    [ids.org, ids.a],
  );
  fixture.equipment = equipment.rows[0].id;
  for (const [name, doctorRequirement, roomRequired, before, after] of [
    ["standard", "required", true, 10, 10],
    ["dual", "required", true, 0, 0],
    ["mri", "required", true, 0, 0],
    ["capacity", "none", true, 0, 0],
  ] as const) {
    const { rows } = await db.query<{ id: string }>(
      `insert into public.services(organization_id,clinic_id,name,duration_minutes,buffer_before,buffer_after,doctor_requirement,room_required,minimum_room_capacity)
       values($1,$2,$3,30,$4,$5,$6,$7,1) returning id`,
      [ids.org, ids.a, name, before, after, doctorRequirement, roomRequired],
    );
    fixture[name] = rows[0].id;
  }
  for (const service of ["standard", "dual", "mri"])
    for (const doctor of ["doctor1", "doctor2"])
      await db.query(
        "insert into public.doctor_services(doctor_location_id,service_id,clinic_id) values($1,$2,$3)",
        [fixture[doctor], fixture[service], ids.a],
      );
  for (const service of ["standard", "dual", "mri"])
    for (const room of ["room1", "room2"])
      await db.query(
        "insert into public.service_rooms(service_id,room_id,clinic_id) values($1,$2,$3)",
        [fixture[service], fixture[room], ids.a],
      );
  await db.query(
    "insert into public.service_rooms(service_id,room_id,clinic_id) values($1,$2,$3)",
    [fixture.capacity, fixture.capacityRoom, ids.a],
  );
  await db.query(
    "insert into public.service_equipment(service_id,equipment_id,clinic_id) values($1,$2,$3)",
    [fixture.mri, fixture.equipment, ids.a],
  );
  for (let weekday = 1; weekday <= 5; weekday++) {
    const rules: [string, string | null, string | null, string | null][] = [
      ["clinic", null, null, null],
      ["doctor", fixture.doctor1, null, null],
      ["doctor", fixture.doctor2, null, null],
      ["room", null, fixture.room1, null],
      ["room", null, fixture.room2, null],
      ["room", null, fixture.capacityRoom, null],
      ["equipment", null, null, fixture.equipment],
    ];
    for (const [kind, doctor, room, equipmentId] of rules)
      await db.query(
        `insert into public.availability_rules(organization_id,clinic_id,name,resource_kind,doctor_location_id,room_id,equipment_id,weekday,start_time,end_time,valid_from)
         values($1,$2,$3,$4,$5,$6,$7,$8,'08:00','18:00','2026-01-01')`,
        [ids.org, ids.a, `${kind}-${weekday}-${doctor ?? room ?? equipmentId ?? ids.a}`, kind, doctor, room, equipmentId, weekday],
      );
  }
  await db.query(
    `insert into public.schedule_exceptions(organization_id,clinic_id,name,resource_kind,room_id,starts_at,ends_at,exception_kind)
     values($1,$2,'Room block','room',$3,'2027-01-13T09:00:00Z','2027-01-13T10:00:00Z','manual')`,
    [ids.org, ids.a, fixture.room1],
  );
  await db.query(
    `insert into public.schedule_exceptions(organization_id,clinic_id,name,resource_kind,doctor_location_id,starts_at,ends_at,exception_kind)
     values($1,$2,'Doctor leave','doctor',$3,'2027-01-14T08:00:00Z','2027-01-14T18:00:00Z','leave')`,
    [ids.org, ids.a, fixture.doctor1],
  );
  await db.query(
    `insert into public.schedule_exceptions(organization_id,clinic_id,name,resource_kind,equipment_id,starts_at,ends_at,exception_kind)
     values($1,$2,'Equipment maintenance','equipment',$3,'2027-01-15T08:00:00Z','2027-01-15T18:00:00Z','maintenance')`,
    [ids.org, ids.a, fixture.equipment],
  );
});

afterAll(async () => db.close());

describe("Phase 3 scheduling engine", () => {
  it("1. allows a free doctor and all required resources", async () => {
    expect((await create(0, "standard", "2027-01-04T09:00:00Z")).ok).toBe(true);
  });
  it("2. reports a doctor conflict", async () => {
    await create(1, "standard", "2027-01-05T09:00:00Z", { doctor_id: fixture.doctor1, room_id: fixture.room1 });
    const result = await create(2, "standard", "2027-01-05T09:00:00Z", { doctor_id: fixture.doctor1, room_id: fixture.room2 });
    expect(codes(result)).toContain("DOCTOR_CONFLICT");
  });
  it("3. reports a room conflict", async () => {
    await create(3, "dual", "2027-01-06T09:00:00Z", { doctor_id: fixture.doctor1, room_id: fixture.room1 });
    const result = await create(4, "dual", "2027-01-06T09:00:00Z", { doctor_id: fixture.doctor2, room_id: fixture.room1 });
    expect(codes(result)).toContain("ROOM_CONFLICT");
  });
  it("4. reports an equipment conflict", async () => {
    await create(5, "mri", "2027-01-07T09:00:00Z", { doctor_id: fixture.doctor1, room_id: fixture.room1 });
    const result = await create(6, "mri", "2027-01-07T09:00:00Z", { doctor_id: fixture.doctor2, room_id: fixture.room2 });
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("EQUIPMENT_CONFLICT");
  });
  it("5. permits two simultaneous appointments with two doctors and rooms", async () => {
    const first = await create(7, "dual", "2027-01-08T09:00:00Z");
    const second = await create(8, "dual", "2027-01-08T09:00:00Z");
    expect([first.ok, second.ok]).toEqual([true, true]);
    expect(first.assignment?.doctor_id).not.toBe(second.assignment?.doctor_id);
    expect(first.assignment?.room_id).not.toBe(second.assignment?.room_id);
  });
  it("6. permits only one simultaneous appointment for one machine", async () => {
    const first = await create(9, "mri", "2027-01-11T09:00:00Z");
    const second = await create(10, "mri", "2027-01-11T09:00:00Z");
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
  });
  it("7. detects buffer overlap", async () => {
    await create(11, "standard", "2027-01-12T10:00:00Z", { doctor_id: fixture.doctor1, room_id: fixture.room1 });
    const result = await create(12, "standard", "2027-01-12T10:35:00Z", { doctor_id: fixture.doctor1, room_id: fixture.room1 });
    expect(result.ok).toBe(false);
  });
  it("8. allows an appointment exactly after the buffer", async () => {
    expect((await create(13, "standard", "2027-01-12T10:50:00Z", { doctor_id: fixture.doctor1, room_id: fixture.room1 })).ok).toBe(true);
  });
  it("9. rejects a schedule block", async () => {
    const result = await create(14, "dual", "2027-01-13T09:00:00Z", { doctor_id: fixture.doctor1, room_id: fixture.room1 });
    expect(codes(result)).toContain("ROOM_UNAVAILABLE");
  });
  it("10. rejects doctor leave", async () => {
    const result = await create(15, "dual", "2027-01-14T09:00:00Z", { doctor_id: fixture.doctor1, room_id: fixture.room1 });
    expect(codes(result)).toContain("DOCTOR_UNAVAILABLE");
  });
  it("11. rejects equipment maintenance", async () => {
    const result = await create(16, "mri", "2027-01-15T09:00:00Z", { doctor_id: fixture.doctor1, room_id: fixture.room1 });
    expect(result.ok).toBe(false);
  });
  it("12. rejects times outside working hours", async () => {
    expect((await create(17, "dual", "2027-01-18T05:00:00Z")).ok).toBe(false);
  });
  it("13. cancellation releases resources without deleting history", async () => {
    const first = await create(18, "mri", "2027-01-19T09:00:00Z");
    const cancelled = await one<Result>("public.cancel_appointment($1,$2,$3,$4)", [ids.a, first.appointment_id, "Patient request", first.updated_at]);
    expect(cancelled.ok).toBe(true);
    expect((await create(19, "mri", "2027-01-19T09:00:00Z")).ok).toBe(true);
    const history = await db.query("select * from public.appointment_history where appointment_id=$1 and event='CANCELLED'", [first.appointment_id]);
    expect(history.rows).toHaveLength(1);
  });
  it("14. rescheduling releases the previous slot", async () => {
    const first = await create(20, "mri", "2027-01-20T09:00:00Z");
    const moved = await one<Result>("public.reschedule_appointment($1,$2,$3,$4)", [ids.a, first.appointment_id, { start_at: "2027-01-20T11:00:00Z", equipment_ids: [] }, first.updated_at]);
    expect(moved.ok).toBe(true);
    expect((await create(21, "mri", "2027-01-20T09:00:00Z")).ok).toBe(true);
  });
  it("15. failed rescheduling leaves the original appointment unchanged", async () => {
    const first = await create(22, "mri", "2027-01-21T09:00:00Z");
    await create(23, "mri", "2027-01-21T11:00:00Z");
    const result = await one<Result>("public.reschedule_appointment($1,$2,$3,$4)", [ids.a, first.appointment_id, { start_at: "2027-01-21T11:00:00Z", equipment_ids: [] }, first.updated_at]);
    expect(result.ok).toBe(false);
    const { rows } = await db.query<{ start_at: Date }>("select start_at from public.appointments where id=$1", [first.appointment_id]);
    expect(new Date(rows[0].start_at).toISOString()).toBe("2027-01-21T09:00:00.000Z");
  });
  it("16. automatically assigns another valid room", async () => {
    await create(24, "dual", "2027-01-22T09:00:00Z", { doctor_id: fixture.doctor1, room_id: fixture.room1 });
    const second = await create(25, "dual", "2027-01-22T09:00:00Z");
    expect(second.ok).toBe(true);
    expect(second.assignment?.room_id).toBe(fixture.room2);
  });
  it("17. serializes concurrent booking attempts for the same scarce resource", async () => {
    const results = await Promise.all([
      create(26, "mri", "2027-01-25T09:00:00Z"),
      create(27, "mri", "2027-01-25T09:00:00Z"),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
  });
  it("18. returns a possible duplicate warning", async () => {
    await create(28, "dual", "2027-01-26T09:00:00Z");
    const duplicate = await create(28, "dual", "2027-01-26T11:00:00Z");
    expect(duplicate.requires_override).toBe(true);
    expect(duplicate.warnings?.[0].code).toBe("POSSIBLE_DUPLICATE");
  });
  it("19. allows and records an authorized duplicate override", async () => {
    const duplicate = await create(28, "dual", "2027-01-26T11:00:00Z", { override_duplicate: true, override_reason: "Confirmed with patient" });
    expect(duplicate.ok).toBe(true);
    const { rows } = await db.query("select * from public.appointment_history where appointment_id=$1 and event='DUPLICATE_OVERRIDE'", [duplicate.appointment_id]);
    expect(rows).toHaveLength(1);
  });
  it("20. enforces cross-clinic isolation", async () => {
    await expect(one("public.create_appointment($1,$2)", [ids.b, { patient_id: patients[0], service_id: fixture.dual, start_at: "2027-01-27T09:00:00Z" }], ids.reception)).rejects.toThrow("Access denied");
    const visible = await callerQuery(db, ids.reception, "select * from public.appointments where clinic_id=$1", [ids.b]);
    expect(visible.rows).toHaveLength(0);
  });
  it("21. denies appointment creation without scheduling permission", async () => {
    await expect(create(29, "dual", "2027-01-27T09:00:00Z", {}, ids.doctor)).rejects.toThrow("Access denied");
  });
  it("22. shares capacity up to the configured limit and rejects overflow", async () => {
    expect((await create(0, "capacity", "2027-01-28T09:00:00Z", { room_id: fixture.capacityRoom })).ok).toBe(true);
    expect((await create(1, "capacity", "2027-01-28T09:00:00Z", { room_id: fixture.capacityRoom })).ok).toBe(true);
    const overflow = await create(2, "capacity", "2027-01-28T09:00:00Z", { room_id: fixture.capacityRoom });
    expect(codes(overflow)).toContain("CAPACITY_EXCEEDED");
  });
  it("23. blocks direct table mutations even for an owner", async () => {
    await expect(
      callerQuery(
        db,
        ids.owner,
        "insert into public.appointments(organization_id,clinic_id,patient_id,service_id,start_at,end_at,occupied_start_at,occupied_end_at,duration_minutes,buffer_before,buffer_after,created_by) values($1,$2,$3,$4,now(),now()+interval '30 minutes',now(),now()+interval '30 minutes',30,0,0,$5)",
        [ids.org, ids.a, patients[0], fixture.dual, ids.owner],
      ),
    ).rejects.toThrow();
  });
  it("24. permits only one concurrent reschedule with the same version", async () => {
    const first = await create(3, "dual", "2027-02-01T09:00:00Z");
    const attempts = await Promise.allSettled([
      one<Result>("public.reschedule_appointment($1,$2,$3,$4)", [ids.a, first.appointment_id, { start_at: "2027-02-01T10:00:00Z", equipment_ids: [] }, first.updated_at]),
      one<Result>("public.reschedule_appointment($1,$2,$3,$4)", [ids.a, first.appointment_id, { start_at: "2027-02-01T11:00:00Z", equipment_ids: [] }, first.updated_at]),
    ]);
    expect(attempts.filter(item=>item.status==="fulfilled")).toHaveLength(1);
    expect(attempts.filter(item=>item.status==="rejected")).toHaveLength(1);
  });
  it("25. serializes create versus reschedule for one scarce machine", async () => {
    const movable = await create(4, "mri", "2027-02-02T09:00:00Z");
    const attempts = await Promise.allSettled([
      one<Result>("public.reschedule_appointment($1,$2,$3,$4)", [ids.a, movable.appointment_id, { start_at: "2027-02-02T11:00:00Z", equipment_ids: [] }, movable.updated_at]),
      create(5, "mri", "2027-02-02T11:00:00Z"),
    ]);
    const values=attempts.filter((item):item is PromiseFulfilledResult<Result>=>item.status==="fulfilled").map(item=>item.value);
    expect(values.filter(item=>item.ok)).toHaveLength(1);
  });
  it("26. serializes reschedule versus cancellation with optimistic locking", async () => {
    const appointment = await create(6, "dual", "2027-02-03T09:00:00Z");
    const attempts = await Promise.allSettled([
      one<Result>("public.reschedule_appointment($1,$2,$3,$4)", [ids.a, appointment.appointment_id, { start_at: "2027-02-03T10:00:00Z", equipment_ids: [] }, appointment.updated_at]),
      one<Result>("public.cancel_appointment($1,$2,$3,$4)", [ids.a, appointment.appointment_id, "Concurență test", appointment.updated_at]),
    ]);
    expect(attempts.filter(item=>item.status==="fulfilled")).toHaveLength(1);
  });
});
