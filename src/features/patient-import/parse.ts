import "server-only";
import ExcelJS from "exceljs";
import { inflateRawSync } from "node:zlib";
import { importHeaders, importRow, importRows, type ImportRow } from "./model";
export function parseCsv(text: string): string[][] {
  text = text.replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/, 1)[0];
  const separator = first.includes(";") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let closed = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += char;
    } else if (char === '"') {
      if (cell || closed)
        throw new Error("CSV invalid: ghilimele neașteptate.");
      quoted = true;
    } else if (char === separator) {
      row.push(cell);
      cell = "";
      closed = false;
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      cell = "";
      closed = false;
    } else {
      if (closed) throw new Error("CSV invalid: text după ghilimele.");
      cell += char;
    }
    if (rows.length > 501 || row.length > 20 || cell.length > 2000)
      throw new Error("Fișierul depășește limitele importului.");
  }
  if (quoted) throw new Error("CSV invalid: ghilimele neînchise.");
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}
// Bound decompressed XML before asking the workbook parser to allocate memory.
function checkZip(bytes: Buffer) {
  let total = 0,
    entries = 0;
  for (let i = 0; i + 46 <= bytes.length; i++) {
    if (bytes.readUInt32LE(i) !== 0x02014b50) continue;
    const size = bytes.readUInt32LE(i + 24);
    const compressed = bytes.readUInt32LE(i + 20);
    const method = bytes.readUInt16LE(i + 10);
    const offset = bytes.readUInt32LE(i + 42);
    entries++;
    if (
      size > 5_000_000 ||
      entries > 100 ||
      offset + 30 > bytes.length ||
      bytes.readUInt32LE(offset) !== 0x04034b50
    )
      throw new Error("Fișierul Excel este prea complex pentru import.");
    const start =
      offset +
      30 +
      bytes.readUInt16LE(offset + 26) +
      bytes.readUInt16LE(offset + 28);
    if (start + compressed > bytes.length || bytes.readUInt16LE(i + 8) & 1)
      throw new Error("Fișier Excel invalid sau criptat.");
    const packed = bytes.subarray(start, start + compressed);
    const unpacked =
      method === 0
        ? packed
        : method === 8
          ? inflateRawSync(packed, { maxOutputLength: 5_000_000 })
          : null;
    if (!unpacked || unpacked.length !== size)
      throw new Error("Fișier Excel invalid.");
    total += unpacked.length;
    if (total > 12_000_000)
      throw new Error("Fișierul Excel este prea complex pentru import.");
    i +=
      45 +
      bytes.readUInt16LE(i + 28) +
      bytes.readUInt16LE(i + 30) +
      bytes.readUInt16LE(i + 32);
  }
  if (!entries) throw new Error("Fișier Excel invalid.");
}
async function readImportGrid(file:File) {
  if (!file.size || file.size > 2_000_000)
    throw new Error("Fișierul poate avea cel mult 2 MB și 500 de pacienți.");
  let grid: string[][];
  if (file.name.toLowerCase().endsWith(".csv")) {
    grid = parseCsv(await file.text());
  } else if (file.name.toLowerCase().endsWith(".xlsx")) {
    const bytes = Buffer.from(await file.arrayBuffer());
    checkZip(bytes);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      bytes as unknown as Parameters<typeof workbook.xlsx.load>[0],
    );
    if (workbook.worksheets.length !== 1)
      throw new Error("Folosiți un fișier cu o singură foaie.");
    const sheet = workbook.worksheets[0];
    if (sheet.rowCount > 501 || sheet.columnCount > 20)
      throw new Error("Fișierul depășește limitele importului.");
    grid = [];
    sheet.eachRow((row) => {
      const values: string[] = [];
      for (let i = 1; i <= sheet.columnCount; i++) {
        const cell = row.getCell(i);
        const value = cell.value;
        if (
          typeof value === "object" &&
          value !== null &&
          !(value instanceof Date)
        )
          throw new Error(
            "Eliminați formulele, linkurile și celulele complexe din fișier.",
          );
        values.push(
          value instanceof Date
            ? value.toISOString().slice(0, 10)
            : String(value ?? ""),
        );
      }
      grid.push(values);
    });
  } else throw new Error("Alegeți un fișier CSV sau Excel .xlsx.");
  const headers=grid.shift()?.map(h=>h.trim().toLowerCase());
  if(!headers||headers.some(h=>!h)||new Set(headers).size!==headers.length)throw new Error("Prima linie trebuie să conțină nume distincte pentru coloane.");
  if (!grid.length || grid.length > 500)
    throw new Error("Importul trebuie să conțină între 1 și 500 de pacienți.");
  return {headers,grid};
}
export async function readImportHeaders(file:File){const {headers,grid}=await readImportGrid(file);return {headers,count:grid.length};}
export async function readImportFile(file:File,mapping?:Record<string,string>):Promise<{records:ImportRow[];errors:{row:number;message:string}[]}>{
  const {headers,grid}=await readImportGrid(file);
  const columns=mapping??Object.fromEntries(importHeaders.map(key=>[key,key]));
  if(!columns.name||!columns.internal_id||Object.keys(columns).some(key=>!importHeaders.includes(key as typeof importHeaders[number]))||Object.values(columns).some(header=>header&&!headers.includes(header))||new Set(Object.values(columns).filter(Boolean)).size!==Object.values(columns).filter(Boolean).length)throw new Error("Alegeți coloane distincte pentru nume și cod intern. Câmpurile opționale pot rămâne nealocate.");
  const records: ImportRow[] = [];
  const errors: { row: number; message: string }[] = [];
  grid.forEach((cells, i) => {
    if (cells.length !== headers.length) {
      errors.push({ row: i + 2, message: "Număr incorect de coloane." });
      return;
    }
    const parsed = importRow.safeParse(
      Object.fromEntries(importHeaders.map(key=>[key,columns[key]?(cells[headers.indexOf(columns[key])]??"").trim():""])),
    );
    if (parsed.success) records.push(parsed.data);
    else
      errors.push({
        row: i + 2,
        message: parsed.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join(" "),
      });
  });
  if (!errors.length) importRows.parse(records);
  return { records, errors };
}
