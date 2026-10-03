import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { stagingEnv } from "./staging-env.mjs";

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
function check(condition, label) { if (!condition) throw new Error(`FAIL: ${label}`); console.log(`PASS: ${label}`); }
function denied(result) { return result.error ? result.error.code === "42501" || result.error.code === "PGRST301" : Array.isArray(result.data) && result.data.length === 0; }
async function request(url, config) {
  const bypass = config?.env.STAGING_PREVIEW_BYPASS_SECRET;
  // Every request supplies the scoped header; setting a bypass cookie would
  // introduce a Vercel 307 redirect instead of returning the application route.
  const headers = { "Cache-Control": "no-cache", ...(bypass && new URL(url).origin === config.origin ? { "x-vercel-protection-bypass": bypass } : {}) };
  return fetch(url, { redirect: "manual", signal: AbortSignal.timeout(30000), headers });
}
async function smoke(config) {
  await deployment(config);
  const client = createClient(config.env.NEXT_PUBLIC_SUPABASE_URL, config.publicKey, options);
  const settings = await fetch(`${config.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: config.publicKey }, redirect: "error", signal: AbortSignal.timeout(30000) });
  check(settings.ok, "hosted Auth settings reachable with the staging public key");
  const admin = createClient(config.env.NEXT_PUBLIC_SUPABASE_URL, config.env.SUPABASE_SERVICE_ROLE_KEY, options);
  const buckets = await admin.storage.listBuckets();
  check(!buckets.error, "staging server key authenticates to hosted Storage");
  for (const id of ["voxa-medical", "voxa-branding"]) check(buckets.data?.some(bucket => bucket.id === id && !bucket.public), `hosted ${id} bucket is private`);
  for (const table of ["patients", "appointments", "organization_settings", "audit_logs"]) {
    const result = await client.from(table).select("*").limit(1);
    check(denied(result), `anonymous access denied: ${table}`);
  }
  for (const route of ["/login", "/register", "/forgot-password"]) {
    const response = await request(config.origin + route, config);
    check(response.status === 200, `hosted public route ${route}`);
  }
  for (const route of ["/", "/dashboard", "/onboarding", "/reset-password", "/clinics/00000000-0000-4000-8000-000000000001/settings"]) {
    const response = await request(config.origin + route, config);
    let target;
    let destination = response.headers.get("location");
    // Next.js emits its redirect meta tag after a streaming response has begun.
    // Check the actual bounded destination, not just the initial HTTP status.
    if (response.status === 200) {
      const html = await response.text();
      destination = html.match(/<meta id="__next-page-redirect" http-equiv="refresh" content="[01];url=([^"<>]+)"\s*\/>/)?.[1]?.replaceAll("&amp;", "&") ?? null;
    }
    try { if (destination) target = new URL(destination, config.origin); } catch { /* Fail below. */ }
    check([200,302,303,307,308].includes(response.status) && target?.origin === config.origin && target.pathname === "/login", `logged-out route protected: ${route}`);
  }
  const callback = await request(config.origin + "/auth/callback?next=https://evil.invalid", config);
  const destination = new URL(callback.headers.get("location"), config.origin);
  check(destination.origin === config.origin && destination.pathname === "/login", "invalid email callback cannot redirect off-site");
  check(callback.headers.get("cache-control")?.includes("no-store") && callback.headers.get("referrer-policy") === "no-referrer", "callback prevents caching and referrer token disclosure");
  const page = await request(config.origin + "/login", config);
  const html = await page.text();
  const sources = [...new Set([...html.matchAll(/(?:src|href)="([^"<>]+\.js(?:\?[^"<>]*)?)"/g)].map(match => match[1]))];
  check(sources.length > 0, "deployed JavaScript assets discovered");
  const secrets = ["SUPABASE_SERVICE_ROLE_KEY","CONFIRMATION_TOKEN_SECRET","BOOKING_RATE_LIMIT_SALT","CRON_SECRET","STAFF_INVITATION_PROVIDER_TOKEN","STAGING_PREVIEW_BYPASS_SECRET"].map(key => config.env[key]).filter(Boolean);
  check(secrets.every(secret => !html.includes(secret)), "server secrets absent from rendered login HTML");
  for (const source of sources) {
    const url = new URL(source.replaceAll("&amp;", "&"), config.origin);
    check(url.origin === config.origin, "JavaScript asset origin is staging");
    const asset = await request(url, config);
    check(asset.ok, "deployed JavaScript asset loads");
    const content = await asset.text();
    check(secrets.every(secret => !content.includes(secret)), "server secrets absent from deployed JavaScript asset");
  }
  console.log("Smoke checks passed. Registration/email delivery, authenticated RLS, onboarding, Storage and browser acceptance remain separate gates.");
}

async function isolation(config) {
  await deployment(config);
  const file = process.env.STAGING_ACTORS_FILE || ".staging-actors.local.json";
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}; use docs/staging-actors.example.json after real hosted signup/onboarding.`);
  const actors = JSON.parse(fs.readFileSync(file, "utf8"));
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const side of ["a","b"]) for (const name of ["clinicId","organizationId","patientId","appointmentId"]) check(uuid.test(actors[side]?.[name] || ""), `Clinic ${side.toUpperCase()} ${name} configured`);
  check(actors.a.organizationId !== actors.b.organizationId, "test clinics belong to different organizations");
  const login = async actor => {
    const client = createClient(config.env.NEXT_PUBLIC_SUPABASE_URL, config.publicKey, options);
    const { error } = await client.auth.signInWithPassword({ email: actor.email, password: actor.password });
    check(!error, "real hosted actor login (identity suppressed)");
    return client;
  };
  const a = await login(actors.a), b = await login(actors.b);
  for (const [client, own, other] of [[a,actors.a,actors.b],[b,actors.b,actors.a]]) {
    for (const [table, idName] of [["patients","patientId"],["appointments","appointmentId"]]) {
      const ownRow = await client.from(table).select("id,organization_id,clinic_id").eq("id", own[idName]);
      check(!ownRow.error && ownRow.data.length === 1 && ownRow.data[0].organization_id === own.organizationId && ownRow.data[0].clinic_id === own.clinicId, `own ${table} exists in the expected tenant`);
      check(denied(await client.from(table).select("id").eq("id", other[idName])), `cross-tenant SELECT denied: ${table}`);
    }
    for (const table of ["organization_settings","clinic_memberships","audit_logs"]) check(denied(await client.from(table).select("*").eq("organization_id", other.organizationId).limit(1)), `cross-tenant SELECT denied: ${table}`);
    const membership = await client.from("clinic_memberships").select("user_id").eq("clinic_id", other.clinicId);
    check(denied(membership), "cross-tenant user enumeration denied");
    const otherMembership = await (client === a ? b : a).from("clinic_memberships").select("user_id").eq("clinic_id", other.clinicId);
    check(!otherMembership.error && otherMembership.data.length > 0, "other tenant membership probe targets real data");
    for (const row of otherMembership.data) check(denied(await client.from("profiles").select("id").eq("id", row.user_id)), "cross-tenant profile enumeration denied");
    check(denied(await client.from("appointments").update({ status: "CANCELLED" }).eq("id", other.appointmentId).select("id")), "cross-tenant appointment UPDATE denied");
    check(denied(await client.from("patients").delete().eq("id", other.patientId).select("id")), "cross-tenant patient DELETE denied");
    const rpc = await client.rpc("list_core", { cid: other.clinicId, module: "patients", query: "", page_number: 1, sort_key: "name", descending: false });
    check(rpc.error?.code === "42501", "crafted cross-tenant RPC denied");
    if (!other.documentPath) throw new Error("documentPath is required: upload and register a real private document through each clinic's hosted UI first.");
    check(other.documentPath.startsWith(`${other.clinicId}/${other.patientId}/documents/`), "private document path matches the test tenant");
    const ownStorage = await (client === a ? b : a).storage.from("voxa-medical").download(other.documentPath);
    check(!ownStorage.error && ownStorage.data?.size > 0, "cross-tenant Storage probe targets an existing authorized object");
    const read = await client.storage.from("voxa-medical").download(other.documentPath);
    check(Boolean(read.error) && !read.data, "cross-tenant Storage download denied");
    const signed = await client.storage.from("voxa-medical").createSignedUrl(other.documentPath, 60);
    check(Boolean(signed.error) && !signed.data?.signedUrl, "cross-tenant signed URL creation denied");
    const path = `${other.clinicId}/${other.patientId}/documents/forbidden-${crypto.randomUUID()}.pdf`;
    const upload = await client.storage.from("voxa-medical").upload(path, new Blob(["%PDF-1.4\nsynthetic staging probe"], { type: "application/pdf" }), { upsert: false });
    check(Boolean(upload.error) && !upload.data, "cross-tenant Storage upload denied");
  }
  console.log("Hosted Clinic A/B isolation probes passed. Doctor/reception/admin mutation checks, invitation replay and browser acceptance remain separate gates.");
}
async function deployment(config) {
  const response = await request(config.origin + "/api/staging/status", config);
  check(response.ok, "deployed app exposes the staging configuration marker");
  const status = await response.json();
  check(status.environment === "staging" && status.supabaseProjectRef === config.ref && status.origin === config.origin, "deployed app and probes use the same isolated staging backend");
}
try {
  const config = stagingEnv();
  const mode = process.argv[2] || "check";
  if (mode === "check") console.log(`PASS: isolated staging environment validated (${config.ref}; ${config.origin}). Secret values suppressed.`);
  else if (mode === "smoke") await smoke(config);
  else if (mode === "rls") await isolation(config);
  else throw new Error("Expected check, smoke or rls.");
} catch (error) { console.error(error.message); process.exitCode = 1; }
