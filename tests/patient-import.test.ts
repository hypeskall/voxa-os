import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { callerQuery, ids, migratedDatabase } from "./support/database";
vi.mock("server-only", () => ({}));
import ExcelJS from "exceljs";
import { parseCsv, readImportFile } from "../src/features/patient-import/parse";
let db: PGlite;
beforeAll(async () => {
  db = await migratedDatabase();
});
afterAll(async () => db.close());
const row = {
  name: "Import Test",
  internal_id: "IMP-1",
  birth_date: "1990-02-01",
  phone: "+40700000001",
  email: "import@example.test",
};
async function run(uid: string, records: unknown[], preview = true) {
  return (
    await callerQuery<{ result: { created: number; skipped: number } }>(
      db,
      uid,
      "select public.import_patients($1,$2,$3) result",
      [ids.a, records, preview],
    )
  ).rows[0].result;
}
describe("patient import", () => {
  it("maps clinic export columns and permits unmapped optional fields",async()=>{
    const file=new File(["Nume complet;Cod;Extra\nAna Import;MAP-1;ignoră\n"],"mapped.csv");
    const result=await readImportFile(file,{name:"nume complet",internal_id:"cod",birth_date:"",phone:"",email:""});
    expect(result.records[0]).toEqual({name:"Ana Import",internal_id:"MAP-1",birth_date:"",phone:"",email:""});
    await expect(readImportFile(file,{name:"nume complet",internal_id:"nume complet"})).rejects.toThrow(/distincte/);
  });
  it("parses quoted CSV, escaped quotes, CRLF and semicolon exports", () => {
    expect(parseCsv('name;internal_id\r\n"Pop, Ana";"ID-""1"\r\n')).toEqual([
      ["name", "internal_id"],
      ["Pop, Ana", 'ID-"1'],
    ]);
    expect(() => parseCsv('"bad')).toThrow();
  });
  it("validates the entire file and reports row errors without importing", async () => {
    const file = new File(
      ["name,internal_id,birth_date,phone,email\nA,,2030-01-01,,bad\n"],
      "bad.csv",
    );
    const result = await readImportFile(file);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(2);
  });
  it("reads Excel dates and rejects formulas", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Patients");
    sheet.addRow(["name", "internal_id", "birth_date", "phone", "email"]);
    sheet.addRow([
      "Excel Test",
      "X-1",
      new Date("1990-02-01"),
      "+40700000001",
      "excel@example.test",
    ]);
    const data = await workbook.xlsx.writeBuffer();
    const parsed = await readImportFile(
      new File([new Uint8Array(data)], "patients.xlsx"),
    );
    expect(parsed.records[0].birth_date).toBe("1990-02-01");
    sheet.getCell("A2").value = { formula: '"Test"', result: "Test" };
    await expect(
      readImportFile(
        new File(
          [new Uint8Array(await workbook.xlsx.writeBuffer())],
          "formula.xlsx",
        ),
      ),
    ).rejects.toThrow(/formulele/);
  });
  it("previews duplicates inside the file without database writes", async () => {
    expect(await run(ids.reception, [row, row])).toMatchObject({
      created: 1,
      skipped: 1,
    });
    const found = await db.query(
      "select id from public.patients where internal_id='IMP-1'",
    );
    expect(found.rows).toHaveLength(0);
  });
  it("commits atomically, audits counts and remains idempotent", async () => {
    expect(await run(ids.reception, [row, row], false)).toMatchObject({
      created: 1,
      skipped: 1,
    });
    expect(await run(ids.reception, [row], false)).toMatchObject({
      created: 0,
      skipped: 1,
    });
    const logs = await db.query<{ metadata: unknown }>(
      "select metadata from public.audit_logs where action='import' and clinic_id=$1",
      [ids.a],
    );
    expect(logs.rows).toHaveLength(2);
    expect(
      logs.rows.some(
        (log) =>
          JSON.stringify(log.metadata) ===
          JSON.stringify({ rows: 2, created: 1, skipped: 1 }),
      ),
    ).toBe(true);
  });
  it("does not merge different people sharing family contacts", async () => {
    expect(
      await run(
        ids.reception,
        [
          {
            ...row,
            name: "Another Person",
            internal_id: "IMP-2",
            birth_date: "1992-01-01",
          },
        ],
        false,
      ),
    ).toMatchObject({ created: 1, skipped: 0 });
  });
  it("rolls back all rows when any row is invalid", async () => {
    await expect(
      run(
        ids.reception,
        [
          { ...row, internal_id: "IMP-ROLLBACK", name: "Valid Person" },
          { ...row, name: "X" },
        ],
        false,
      ),
    ).rejects.toThrow(/Invalid import/);
    expect(
      (
        await db.query(
          "select id from public.patients where internal_id='IMP-ROLLBACK'",
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("denies outsiders and doctors without patient-management permission", async () => {
    await expect(run(ids.outsider, [row], false)).rejects.toThrow(
      /Access denied/,
    );
    await expect(run(ids.doctor, [row], false)).rejects.toThrow(
      /Access denied/,
    );
  });
  it("requires verified MFA when enrolled", async () => {
    await db.query(
      "insert into auth.mfa_factors(user_id,status) values($1,'verified')",
      [ids.reception],
    );
    await expect(run(ids.reception, [row], false)).rejects.toThrow(/MFA/);
  });
});
