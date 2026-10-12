import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { callerQuery, ids, migratedDatabase } from "./support/database";
let db: PGlite;
beforeAll(async () => { db = await migratedDatabase(true, undefined, true); await db.exec("update private.upload_security set required=true where id"); });
afterAll(async () => db.close());
describe("database-backed upload quarantine", () => {
  it("denies bypassing the scan registry through direct RPC or table access", async () => {
    await expect(callerQuery(db, ids.owner, "select public.record_medical_file_scan('fake.enc',repeat('a',64),repeat('b',64),now())")).rejects.toThrow(/permission denied/);
    await expect(callerQuery(db, ids.owner, "insert into private.medical_file_scans values('fake.enc',repeat('a',64),repeat('b',64),now(),now())")).rejects.toThrow(/permission denied/);
    await expect(callerQuery(db, ids.owner, `select public.save_patient_document('${ids.a}',gen_random_uuid(),null,gen_random_uuid(),'Title','${ids.a}/patient/documents/not-scanned.enc','name.pdf','application/pdf',100,true)`)).rejects.toThrow(/Antivirus verification/);
    await expect(callerQuery(db, ids.owner, `select public.set_doctor_credentials('${ids.a}',gen_random_uuid(),null,'${ids.a}/doctors/not-scanned.enc','image/png',null,null)`)).rejects.toThrow(/Antivirus verification/);
  });
  it("requires an existing encrypted object and a recent definition date for trusted attestations", async () => {
    const path = `${ids.a}/${ids.owner}/documents/test.enc`;
    await db.query("insert into storage.objects(bucket_id,name) values('voxa-medical',$1)", [path]);
    async function attest(object: string, date: string) {
      return db.transaction(async tx => { await tx.exec("set local role service_role"); return tx.query("select public.record_medical_file_scan($1,repeat('a',64),repeat('b',64),$2)", [object, date]); });
    }
    await expect(attest(path, new Date(Date.now() - 49 * 3600000).toISOString())).rejects.toThrow(/Invalid scan/);
    await expect(attest(path + '.missing', new Date().toISOString())).rejects.toThrow(/Invalid scan/);
    await attest(path, new Date().toISOString());
    expect((await db.query("select object_path from private.medical_file_scans")).rows).toEqual([{ object_path: path }]);
  });
});
