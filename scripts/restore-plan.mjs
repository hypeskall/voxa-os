// Pure restoration planning. Data enters psql through stdin, never shell text.
const identifier = value => {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) throw new Error("Invalid SQL identifier.");
  return `"${value}"`;
};
export const qualifiedTable = value => {
  if (!/^(auth|public|private)\.[a-z][a-z0-9_]*$/.test(value)) throw new Error("Invalid snapshot table.");
  return value.split(".").map(identifier).join(".");
};
export const sqlLiteral = value => `'${String(value).replaceAll("'", "''")}'`;

export function restoreTablePlan(table, columns) {
  const target = qualifiedTable(table.name);
  if (table.name === "auth.schema_migrations") return { managed: true };
  if (!Array.isArray(table.rows) || !Array.isArray(columns)) throw new Error("Invalid table plan.");
  if (!columns.length) {
    if (table.rows.length) throw new Error(`Provider compatibility: missing populated table ${table.name}`);
    return { absentEmpty: true };
  }
  const available = new Set(columns.map(c => c.name));
  const source = new Set(table.rows.flatMap(row => Object.keys(row)));
  for (const name of source) if (!available.has(name) && table.rows.some(row => row[name] !== null))
    throw new Error(`Provider compatibility: missing populated column ${table.name}.${name}`);
  const fields = columns.filter(c => !c.generated && (source.has(c.name) || !table.rows.length)).map(c => c.name);
  const names = fields.map(identifier).join(",");
  if (!fields.length) throw new Error("No restorable columns.");
  return {
    target, fields,
    sourceFields: [...source].filter(name => available.has(name)),
    sql: table.rows.length ? `insert into ${target} (${names}) overriding system value select ${names} from jsonb_populate_recordset(null::${target},${sqlLiteral(JSON.stringify(table.rows))}::jsonb);` : "",
  };
}

export function canonicalRows(rows, fields) {
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value;
  return JSON.stringify(rows.map(row => JSON.stringify(canonical(Object.fromEntries(fields.map(name => [name, row[name]]))))).sort());
}
