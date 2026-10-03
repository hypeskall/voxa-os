import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { stagingEnv } from "./staging-env.mjs";

export async function expectedSchema() {
  const db = new PGlite();
  try {
    await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create schema storage;create table storage.buckets(id text primary key,name text,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;`);
    for (const file of fs.readdirSync("supabase/migrations").filter(f => f.endsWith(".sql")).sort()) await db.exec(fs.readFileSync(`supabase/migrations/${file}`, "utf8"));
    return (await db.query(fs.readFileSync("scripts/staging-schema.sql", "utf8"))).rows;
  } finally { await db.close(); }
}
export function compareSchema(expected, actual) {
  const map = new Map(actual.map(row => [`${row.kind}:${row.key}`, row.definition]));
  const sort = value => Array.isArray(value) ? value.map(sort) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sort(value[key])])) : typeof value === "string" ? value.replace(/\r\n/g, "\n") : value;
  const canonical = value => JSON.stringify(sort(value));
  const failures = [];
  for (const row of expected) {
    const key = `${row.kind}:${row.key}`;
    if (!map.has(key)) failures.push(`Missing ${key}`);
    else if (canonical(row.definition) !== canonical(map.get(key))) failures.push(`Changed ${key}`);
  }
  // Detect additional permissive policies/RPC grants that weaken the baseline.
  const expectedKeys = new Set(expected.map(row => `${row.kind}:${row.key}`));
  for (const row of actual) {
    const key = `${row.kind}:${row.key}`;
    if (row.kind === "table" && !row.definition.rls) failures.push(`RLS disabled ${row.key}`);
    if (row.kind === "policy" && !expectedKeys.has(key) && (row.key.startsWith("public.") || row.key.includes("voxa_"))) failures.push(`Unexpected ${key}`);
    if (row.kind === "function" && row.definition.security_definer && row.definition.anon_execute && !expectedKeys.has(key)) failures.push(`Unexpected anonymous security-definer ${row.key}`);
  }
  return failures;
}
export async function managementQuery(ref, token, query) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, read_only: true }), signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Hosted schema query failed (HTTP ${response.status}); response body suppressed.`);
  return response.json();
}
export async function verifyHostedSchema(config) {
  const token = config.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("Schema inspection needs SUPABASE_ACCESS_TOKEN from Supabase Account > Access Tokens; keep it operator-only.");
  const expected = await expectedSchema();
  const actual = await managementQuery(config.ref, token, fs.readFileSync("scripts/staging-schema.sql", "utf8"));
  const failures = compareSchema(expected, actual);
  const migrations = await managementQuery(config.ref, token, "select version from supabase_migrations.schema_migrations order by version");
  const versions = fs.readdirSync("supabase/migrations").filter(f => f.endsWith(".sql")).map(f => f.split("_")[0]).sort();
  if (JSON.stringify(migrations.map(row => row.version)) !== JSON.stringify(versions)) failures.push("Hosted migration history does not exactly match the repository.");
  if (failures.length) throw new Error(failures.join("\n"));
  console.log(`PASS: ${versions.length} hosted migrations and ${expected.length} catalog checks match; RLS and private bucket configuration verified structurally. Behavioral isolation still needs authenticated acceptance.`);
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/staging-schema.mjs")) {
  try {
    if (process.argv[2] === "--local") {
      const expected = await expectedSchema();
      console.log(`PASS: migration catalog inventory generated locally (${expected.length} checks). No hosted verification claimed.`);
    } else await verifyHostedSchema(stagingEnv());
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
