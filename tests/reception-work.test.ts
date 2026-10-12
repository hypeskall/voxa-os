import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { callerQuery, ids, migratedDatabase } from "./support/database";
let db: PGlite;
let task: string;
let version: string;
let patient:string;let service:string;let wait:string;
beforeAll(async () => {
  db = await migratedDatabase();
  patient=(await db.query<{id:string}>("insert into public.patients(organization_id,clinic_id,name,internal_id) values($1,$2,'Waiting Test','WAIT-TEST') returning id",[ids.org,ids.a])).rows[0].id;
  service=(await db.query<{id:string}>("insert into public.services(organization_id,clinic_id,name,duration_minutes,doctor_requirement,room_required) values($1,$2,'Waiting consultation',30,'none',false) returning id",[ids.org,ids.a])).rows[0].id;
  await db.query("insert into public.availability_rules(organization_id,clinic_id,name,resource_kind,weekday,start_time,end_time,valid_from) values($1,$2,'Waiting hours','clinic',1,'08:00','18:00','2026-01-01')",[ids.org,ids.a]);
});
afterAll(async () => db.close());
const payload = {
  kind: "TASK",
  title: "Call patient",
  notes: "Administrative only",
  assigned_to: ids.reception,
};
const save = (
  uid: string,
  cid: string,
  id: string | null,
  p: unknown,
  v: string | null = null,
) =>
  callerQuery<{ id: string }>(
    db,
    uid,
    "select public.save_reception_work($1,$2,$3,$4) id",
    [cid, id, p, v],
  );
describe("reception work isolation", () => {
  it("creates a clinic task, lists assignee and records audit without notes", async () => {
    task = (await save(ids.reception, ids.a, null, payload)).rows[0].id;
    const list = await callerQuery<{
      result: {
        items: { id: string; updated_at: string }[];
        staff: { id: string }[];
      };
    }>(
      db,
      ids.reception,
      "select public.reception_workspace($1,'TASK') result",
      [ids.a],
    );
    expect(list.rows[0].result.items[0].id).toBe(task);
    version = list.rows[0].result.items[0].updated_at;
    expect(list.rows[0].result.staff.some((p) => p.id === ids.reception)).toBe(
      true,
    );
    const log = await db.query<{ metadata: unknown }>(
      "select metadata from public.audit_logs where entity='reception_work' and entity_id=$1",
      [task],
    );
    expect(log.rows[0].metadata).toEqual({ kind: "TASK", status: "OPEN" });
  });
  it("rejects inactive or cross-clinic assignees and patient references", async () => {
    await expect(
      save(ids.reception, ids.a, null, {
        ...payload,
        assigned_to: ids.outsider,
      }),
    ).rejects.toThrow(/Inactive assignee/);
    await expect(
      save(ids.reception, ids.a, null, {
        ...payload,
        patient_id: ids.outsider,
      }),
    ).rejects.toThrow(/Invalid patient/);
  });
  it("rejects cross-tenant reads and writes", async () => {
    await expect(save(ids.outsider, ids.a, null, payload)).rejects.toThrow(
      /Access denied/,
    );
    const list = await callerQuery(
      db,
      ids.outsider,
      "select id from public.reception_work where clinic_id=$1",
      [ids.a],
    );
    expect(list.rows).toHaveLength(0);
    await expect(
      save(ids.reception, ids.b, task, payload, version),
    ).rejects.toThrow(/Access denied/);
  });
  it("protects against stale concurrent edits", async () => {
    await save(
      ids.reception,
      ids.a,
      task,
      { ...payload, status: "IN_PROGRESS" },
      version,
    );
    await expect(
      save(ids.reception, ids.a, task, { ...payload, status: "DONE" }, version),
    ).rejects.toThrow(/Stale revision/);
  });
  it("rejects incomplete waiting list requests and direct bookings", async () => {
    await expect(
      save(ids.reception, ids.a, null, { kind: "WAITLIST", title: "Waiting" }),
    ).rejects.toThrow();
    await expect(
      save(ids.reception, ids.a, null, { ...payload, status: "BOOKED" }),
    ).rejects.toThrow(/must be open/);
  });
  it("offers a free slot and books only after a current offer, using the scheduling engine",async()=>{
    wait=(await save(ids.reception,ids.a,null,{kind:"WAITLIST",title:"Earlier appointment",patient_id:patient,service_id:service,preferred_from:"2027-02-01T08:00:00Z",preferred_to:"2027-02-01T15:00:00Z"})).rows[0].id;
    const read=async()=> (await db.query<{updated_at:string;status:string}>("select updated_at::text,status from public.reception_work where id=$1",[wait])).rows[0];
    let current=await read();await expect(callerQuery(db,ids.reception,"select public.book_waitlist_slot($1,$2,$3)",[ids.a,wait,current.updated_at])).rejects.toThrow(/expired or stale/);
    expect((await callerQuery<{result:{ok:boolean}}>(db,ids.reception,"select public.offer_waitlist_slot($1,$2,$3,$4) result",[ids.a,wait,"2027-02-01T09:00:00Z",current.updated_at])).rows[0].result.ok).toBe(true);
    current=await read();expect(current.status).toBe("OFFERED");expect((await callerQuery<{result:{ok:boolean}}>(db,ids.reception,"select public.book_waitlist_slot($1,$2,$3) result",[ids.a,wait,current.updated_at])).rows[0].result.ok).toBe(true);expect((await read()).status).toBe("BOOKED");await expect(callerQuery(db,ids.reception,"select public.book_waitlist_slot($1,$2,$3)",[ids.a,wait,current.updated_at])).rejects.toThrow();
  });
  it("denies low-assurance enrolled accounts", async () => {
    await db.query(
      "insert into auth.mfa_factors(user_id,status) values($1,'verified')",
      [ids.reception],
    );
    await expect(save(ids.reception, ids.a, null, payload)).rejects.toThrow(
      /MFA/,
    );
    expect(
      (
        await callerQuery(
          db,
          ids.reception,
          "select id from public.reception_work",
        )
      ).rows,
    ).toHaveLength(0);
  });
});
