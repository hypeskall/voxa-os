import fs from "node:fs";
import path from "node:path";
import { randomBytes, createCipheriv, createDecipheriv, createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { createClient } from "@supabase/supabase-js";
import { PGlite } from "@electric-sql/pglite";
import { readEnv, stagingEnv } from "./staging-env.mjs";
import { managementQuery } from "./staging-schema.mjs";

const envFile = process.env.RECOVERY_ENV_FILE || ".env.production.local";
if (![".env.production.local", ".env.staging.local"].includes(envFile)) throw new Error("Use a named Voxa environment.");
const env = envFile === ".env.staging.local" ? stagingEnv().env : readEnv(envFile);
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
if (!/^[a-z]{20}$/.test(ref) || !env.SUPABASE_ACCESS_TOKEN || !/^[a-f0-9]{64}$/.test(env.BACKUP_ENCRYPTION_KEY || ""))
  throw new Error("Operator token and a server-only 256-bit backup key are required.");
const key = Buffer.from(env.BACKUP_ENCRYPTION_KEY, "hex");
const query = sql => managementQuery(ref, env.SUPABASE_ACCESS_TOKEN, sql);
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const prefix = Buffer.from("VOXA-SNAPSHOT-1\n");
let phase = "initialization";
function seal(snapshot) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(gzipSync(Buffer.from(JSON.stringify(snapshot)))), cipher.final()]);
  return Buffer.concat([prefix, iv, cipher.getAuthTag(), ciphertext]);
}
function open(bytes) {
  if (!bytes.subarray(0, prefix.length).equals(prefix)) throw new Error("Unknown snapshot format.");
  const offset = prefix.length, decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(offset, offset + 12));
  decipher.setAuthTag(bytes.subarray(offset + 12, offset + 28));
  return JSON.parse(gunzipSync(Buffer.concat([decipher.update(bytes.subarray(offset + 28)), decipher.final()])).toString());
}
function verify(snapshot) {
  if (snapshot.ref !== ref || snapshot.format !== 1 || !Array.isArray(snapshot.tables) || !Array.isArray(snapshot.objects))
    throw new Error("Snapshot target or format mismatch.");
  for (const object of snapshot.objects) {
    const bytes = Buffer.from(object.content, "base64");
    if (bytes.length !== object.size || hash(bytes) !== object.sha256) throw new Error("Stored file integrity failed.");
  }
  if(snapshot.tables.some(t=>! /^(public|private|auth)\.[a-z0-9_]+$/.test(t.name))) throw new Error("Invalid table inventory.");
}
async function capture() {
  const names = await query("select schemaname,tablename from pg_tables where schemaname in ('public','private','auth') order by schemaname,tablename");
  for (const row of names) if (!/^[a-z_]+$/.test(row.schemaname) || !/^[a-z0-9_]+$/.test(row.tablename)) throw new Error("Unexpected table name.");
  // One SELECT provides a consistent MVCC snapshot of all database records.
  const tables = await query(names.map(({schemaname,tablename}) => `select '${schemaname}.${tablename}' as name,coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) as rows from "${schemaname}"."${tablename}" t`).join(" union all "));
  const schema = await query(fs.readFileSync("scripts/staging-schema.sql", "utf8"));
  const migrations = await query("select version,name,statements from supabase_migrations.schema_migrations order by version");
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false,autoRefreshToken:false}});
  const buckets = await client.storage.listBuckets();
  if (buckets.error) throw new Error("Storage inventory failed.");
  const objects = [];
  async function walk(bucket, folder = "") {
    for (let offset = 0; ; offset += 1000) {
      const listing = await client.storage.from(bucket).list(folder, {limit:1000,offset,sortBy:{column:"name",order:"asc"}});
      if (listing.error) throw new Error("Storage listing failed.");
      for (const item of listing.data) {
        const name = folder ? `${folder}/${item.name}` : item.name;
        if (!item.id) { await walk(bucket, name); continue; }
        const file = await client.storage.from(bucket).download(name);
        if (file.error || !file.data) throw new Error("Storage snapshot download failed.");
        const bytes = Buffer.from(await file.data.arrayBuffer());
        objects.push({bucket,name,size:bytes.length,sha256:hash(bytes),type:file.data.type,content:bytes.toString("base64")});
      }
      if (listing.data.length < 1000) break;
    }
  }
  for (const bucket of buckets.data) await walk(bucket.id);
  return {format:1,ref,createdAt:new Date().toISOString(),schema,migrations,tables,buckets:buckets.data,objects};
}
async function drill(snapshot) {
  phase="restore schema";
  if (envFile !== ".env.staging.local") throw new Error("Restore drills accept synthetic staging snapshots only, never production patient records.");
  const db = new PGlite();
  try {
    await db.exec("set timezone='UTC'");
    await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create schema storage;create table storage.buckets(id text primary key,name text,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;`);
    for (const file of fs.readdirSync("supabase/migrations").filter(f => f.endsWith(".sql")).sort()) await db.exec(fs.readFileSync(`supabase/migrations/${file}`, "utf8"));
    await db.exec("set session_replication_role='replica'");
    const auth = snapshot.tables.find(t => t.name === "auth.users");
    for (const user of auth?.rows || []) await db.query("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,$3,$4)", [user.id,user.email,user.email_confirmed_at,user.raw_user_meta_data]);
    const publicTables = snapshot.tables.filter(t => t.name.startsWith("public."));
    await db.exec("truncate " + publicTables.map(t => t.name).join(",") + " cascade");
    for (const table of publicTables) {
      phase="restore "+table.name;
      await db.query(`insert into ${table.name} select * from jsonb_populate_recordset(null::${table.name},$1::jsonb)`, [JSON.stringify(table.rows)]);
      const count = await db.query(`select count(*)::integer as count from ${table.name}`);
      if (count.rows[0].count !== table.rows.length) throw new Error("Restored row count mismatch.");
      const restored = (await db.query(`select to_jsonb(t) as row from ${table.name} t`)).rows.map(r=>r.row);
      const canonical = value => value && typeof value === "object" ? (Array.isArray(value) ? value.map(canonical) : Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]))) : value;
      const rows = data => data.map(r=>JSON.stringify(canonical(r))).sort();
      if (JSON.stringify(rows(restored)) !== JSON.stringify(rows(table.rows))) {
        const expectedRows=rows(table.rows),actualRows=rows(restored);
        const fields=new Set();
        for(let i=0;i<expectedRows.length;i++){const a=JSON.parse(expectedRows[i]),b=JSON.parse(actualRows[i]);for(const field of Object.keys(a))if(JSON.stringify(a[field])!==JSON.stringify(b[field]))fields.add(field);}
        console.error("Restore comparison differs in columns: "+[...fields].join(","));
        throw new Error("Restored data mismatch.");
      }
    }
    console.log(`PASS: isolated local restore of ${publicTables.length} staging application tables; records match exactly. ${snapshot.objects.length} encrypted Storage files verified. Hosted Auth/Storage restoration and PITR remain separate operational gates.`);
  } finally { await db.close(); }
}
try {
  const mode = process.argv[2];
  if (mode === "capture") {
    const snapshot = await capture();
    const bytes = seal(snapshot), decoded = open(bytes); verify(decoded);
    if (JSON.stringify(decoded) !== JSON.stringify(snapshot)) throw new Error("Snapshot roundtrip differs.");
    fs.mkdirSync(".backups",{recursive:true});
    const filename = `.backups/${ref}-${Date.now()}.voxa`;
    fs.writeFileSync(filename,bytes,{flag:"wx"});
    verify(open(fs.readFileSync(filename)));
    fs.writeFileSync(`.backups/${envFile === ".env.production.local" ? "pre-upgrade" : "staging"}.receipt.json`,JSON.stringify({ref,createdAt:snapshot.createdAt,path:filename,verified:true,sha256:hash(bytes)}));
    console.log(`PASS: encrypted snapshot captured and decrypt-verified (${snapshot.tables.length} database tables, ${snapshot.objects.length} Storage files).`);
  } else if (["verify","drill"].includes(mode)) {
    const filename = process.argv[3];
    if (!filename || path.dirname(path.resolve(filename)) !== path.resolve(".backups")) throw new Error("Select a snapshot inside .backups.");
    const snapshot = open(fs.readFileSync(filename)); verify(snapshot);
    if (mode === "drill") await drill(snapshot); else console.log("PASS: snapshot decrypts and file checksums match.");
  } else throw new Error("Use capture, verify SNAPSHOT, or drill STAGING_SNAPSHOT.");
} catch (error) { console.error(`Recovery snapshot failed during ${phase}${/^[A-Z0-9]{5}$/.test(error.code||"")?" ("+error.code+")":""}. Sensitive diagnostics suppressed.`); process.exitCode=1; }
