import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { callerQuery, encryptionTestKeyring, ids, migratedDatabase } from "./support/database";

describe("patient field encryption", () => {
 let db: PGlite;
 let pid: string;
 beforeAll(async () => { db = await migratedDatabase(true, undefined, true); });
 afterAll(async () => { await db?.close(); });
 const query = <T>(sql: string, args: unknown[] = [], uid = ids.owner) => callerQuery<T>(db, uid, sql, args);
 it("stores ciphertext and masks while preserving authorized reads", async () => {
  const saved = await query<{ id: string }>("select public.save_core($1,'patients',null,$2,null) id", [ids.a, { name: "Pacient Secret", internal_id: "PRIVATE-42", cnp: "1234567890123", birth_date: "1980-03-01", email: "secret@example.test", phone: "0712345678", administrative_notes: "Diagnostic secret" }]);
  pid = saved.rows[0].id;
  const stored = await db.query("select to_jsonb(t) row from private.patients t where id=$1", [pid]);
  expect(JSON.stringify(stored.rows)).not.toMatch(/Pacient Secret|PRIVATE-42|1234567890123|secret@example|0712345678|Diagnostic secret|1980-03-01/);
  const read = await query<{ row: Record<string, unknown> }>("select public.read_core($1,'patients',$2) row", [ids.a, pid]);
  expect(read.rows[0].row).toMatchObject({ name: "Pacient Secret", internal_id: "PRIVATE-42", cnp: "1234567890123", birth_date: "1980-03-01", email: "secret@example.test" });
 });
 it("enforces original validation and unique identifiers", async () => {
  await expect(query("select public.save_core($1,'patients',null,$2,null)", [ids.a, { name: "A", internal_id: "bad" }])).rejects.toThrow();
  await expect(query("select public.save_core($1,'patients',null,$2,null)", [ids.a, { name: "Different patient", internal_id: "different", cnp: "1234567890123" }])).rejects.toThrow();
  await expect(query("select public.save_core($1,'patients',null,$2,null)", [ids.a, { name: "Different patient", internal_id: "PRIVATE-42" }])).rejects.toThrow();
 });
 it("preserves clinic isolation and denies activation to staff", async () => {
  const rows = await query("select id from public.patients where id=$1", [pid], ids.outsider);
  expect(rows.rows).toEqual([]);
  await expect(query("select public.activate_patient_encryption()" )).rejects.toThrow();
 });
 it("encrypts clinical notes and still supports patient exports", async () => {
  await query("select public.add_patient_note($1,$2,'Confidential medical finding')", [ids.a, pid]);
  const raw = await db.query("select to_jsonb(t) row from private.patient_notes t");
  expect(JSON.stringify(raw.rows)).not.toContain("Confidential medical finding");
  const read = await query<{ content: string }>("select content from public.patient_notes where patient_id=$1", [pid]);
  expect(read.rows[0].content).toBe("Confidential medical finding");
  const exported = await query<{ data: unknown }>("select public.export_patient($1,$2) data", [ids.a, pid]);
  expect(JSON.stringify(exported.rows)).toContain("Pacient Secret");
 });
 it("fails closed for missing keys, wrong keys and swapped ciphertext", async () => {
  const headers = JSON.stringify({ "x-voxa-patient-keyring": JSON.stringify(encryptionTestKeyring) });
  await db.query("select set_config('request.headers','{}',false)");
  await expect(query("select name from public.patients where id=$1", [pid])).rejects.toThrow("key unavailable");
  await expect(query("select public.add_patient_note($1,$2,'Must never save plaintext')", [ids.a, pid])).rejects.toThrow("key unavailable");
  const wrong = { ...encryptionTestKeyring, keys: { "test-v1": "c3".repeat(32) } };
  await db.query("select set_config('request.headers',$1,false)", [JSON.stringify({ "x-voxa-patient-keyring": JSON.stringify(wrong) })]);
  await expect(query("select name from public.patients where id=$1", [pid])).rejects.toThrow("integrity check failed");
  await db.query("select set_config('request.headers',$1,false)", [headers]);
  await expect(db.query("select private.open_patient_payload(patient_ciphertext,patient_key_id,'patients',clinic_id,gen_random_uuid()) from private.patients where id=$1", [pid])).rejects.toThrow("integrity check failed");
 });
 it("authorizes ciphertext Storage access without sending a master key to Storage", async () => {
  const filePath = `${ids.a}/${pid}/documents/test.enc`;
  await db.query("insert into storage.objects(bucket_id,name) values('voxa-medical',$1)", [filePath]);
  await db.query("select set_config('request.headers','{}',false)");
  try {
   const own = await query<{ allowed: boolean }>("select public.can_access_medical_object($1,'read') allowed", [filePath]);
   expect(own.rows[0].allowed).toBe(true);
   const other = await query<{ allowed: boolean }>("select public.can_access_medical_object($1,'read') allowed", [filePath], ids.outsider);
   expect(other.rows[0].allowed).toBe(false);
   const visible = await query("select name from storage.objects where name=$1", [filePath]);
   expect(visible.rows).toHaveLength(1);
  } finally {
   await db.query("select set_config('request.headers',$1,false)", [JSON.stringify({ "x-voxa-patient-keyring": JSON.stringify(encryptionTestKeyring) })]);
  }
 });
 it("supports new data keys while retaining old reads and rejecting index-key changes", async () => {
  const rotated = { ...encryptionTestKeyring, active: "test-v2", keys: { ...encryptionTestKeyring.keys, "test-v2": "c3".repeat(32) } };
  const configure = (ring: object) => db.query("select set_config('request.headers',$1,false)", [JSON.stringify({ "x-voxa-patient-keyring": JSON.stringify(ring) })]);
  await configure(rotated);
  try {
   await query("select public.add_patient_note($1,$2,'Note written after rotation')", [ids.a, pid]);
   const raw = await db.query<{ patient_key_id: string }>("select patient_key_id from private.patient_notes where patient_id=$1 order by created_at", [pid]);
   expect(raw.rows.map(row => row.patient_key_id)).toEqual(["test-v1", "test-v2"]);
   const notes = await query<{ content: string }>("select content from public.patient_notes where patient_id=$1 order by created_at", [pid]);
   expect(notes.rows.map(row => row.content)).toEqual(["Confidential medical finding", "Note written after rotation"]);
   await configure({ ...rotated, index: "d4".repeat(32) });
   await expect(query("select public.save_core($1,'patients',null,$2,null)", [ids.a, { name: "Rejected index rotation", internal_id: "NO-SAVE" }])).rejects.toThrow("index key mismatch");
  } finally { await configure(encryptionTestKeyring); }
 });
});

it("backfills existing records without clinical side effects and restores encrypted rows", async () => {
 const source = await migratedDatabase(true, undefined, "prepare");
 let restored: PGlite | undefined;
 try {
  await source.exec(readFileSync("supabase/seed-core.sql", "utf8"));
  const patient = (await source.query<{ id: string; name: string }>("select id,name from public.patients where clinic_id=$1 limit 1", [ids.a])).rows[0];
  await callerQuery(source, ids.owner, "select public.add_patient_note($1,$2,'Existing confidential note')", [ids.a, patient.id]);
  const before = await source.query<{ count: number }>("select count(*)::int count from public.audit_logs");
  const headers = JSON.stringify({ "x-voxa-patient-keyring": JSON.stringify(encryptionTestKeyring) });
  await source.query("select set_config('request.headers',$1,false)", [headers]);
  await source.transaction(async tx => { await tx.exec("set local role service_role"); await tx.query("select public.activate_patient_encryption()"); });
  const after = await source.query<{ count: number }>("select count(*)::int count from public.audit_logs");
  expect(after.rows[0].count).toBe(before.rows[0].count);
  const recovered = await callerQuery<{ name: string }>(source, ids.owner, "select name from public.patients where id=$1", [patient.id]);
  expect(recovered.rows[0].name).toBe(patient.name);
  const tables: { name: string; rows: unknown[] }[] = [];
  for (const name of ["patients", "patient_notes"]) {
   const rows = (await source.query<{ row: unknown }>(`select to_jsonb(t) row from private.${name} t`)).rows.map(item => item.row);
   expect(JSON.stringify(rows)).not.toContain("Existing confidential note");
   tables.push({ name, rows });
  }
  restored = await migratedDatabase(true, undefined, true);
  await restored.exec("set session_replication_role='replica'; truncate private.patients cascade");
  for (const table of tables) await restored.query(`insert into private.${table.name} select * from jsonb_populate_recordset(null::private.${table.name},$1::jsonb)`, [JSON.stringify(table.rows)]);
  await restored.exec("set session_replication_role='origin'");
  const restoredPatient = await callerQuery<{ name: string }>(restored, ids.owner, "select name from public.patients where id=$1", [patient.id]);
  expect(restoredPatient.rows[0].name).toBe(patient.name);
  const notes = await callerQuery<{ content: string }>(restored, ids.owner, "select content from public.patient_notes where patient_id=$1", [patient.id]);
  expect(notes.rows[0].content).toBe("Existing confidential note");
 } finally {
  await source.close();
  await restored?.close();
 }
});
