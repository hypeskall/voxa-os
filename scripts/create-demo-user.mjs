import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(process.env.DEMO_ENV_FILE || ".env.production.local");
const username = process.env.DEMO_USERNAME?.trim().toLowerCase();
const password = process.env.DEMO_PASSWORD;
const clinicId = process.env.DEMO_CLINIC_ID;
if (!username || !/^[a-z][a-z0-9._-]{2,31}$/.test(username) || !password || password.length < 8 || !clinicId) {
  throw new Error("Set DEMO_USERNAME, DEMO_PASSWORD (at least 8 characters), and DEMO_CLINIC_ID.");
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Server-side Supabase configuration is required.");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serviceKey, options);
const email = `${username}@users.voxa.invalid`;
const { data: clinic, error: clinicError } = await admin.from("clinics").select("id,organization_id").eq("id", clinicId).is("archived_at", null).single();
if (clinicError || !clinic) throw new Error("The selected clinic is unavailable.");
let user;
for (let page = 1; !user; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
  if (error) throw new Error(`Cannot inspect users (${error.status}).`);
  user = data.users.find((candidate) => candidate.email === email);
  if (data.users.length < 100) break;
}
if (!user) {
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: process.env.DEMO_FULL_NAME || username, username, demo: true },
  });
  if (error || !data.user) throw new Error(`Cannot create demo account (${error?.status}).`);
  user = data.user;
}
// Verify credentials; never reset an existing account's password implicitly.
const publicClient = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, options);
const { error: loginError } = await publicClient.auth.signInWithPassword({ email, password });
if (loginError) throw new Error("Existing demo account does not match the requested credentials.");
const { data: membership, error: membershipError } = await admin.from("clinic_memberships").select("role,active").eq("user_id", user.id).eq("clinic_id", clinicId).maybeSingle();
if (membershipError) throw new Error("Cannot inspect clinic access.");
if (membership && (membership.role !== "RECEPTION" || !membership.active)) throw new Error("Existing account access differs; no permissions changed.");
if (!membership) {
  const { error } = await admin.from("clinic_memberships").insert({ user_id: user.id, organization_id: clinic.organization_id, clinic_id: clinicId, role: "RECEPTION", active: true });
  if (error) throw new Error(`Cannot grant reception access (${error.code}).`);
}
const { error: auditError } = await publicClient.rpc("record_login");
if (auditError) throw new Error("Account login audit failed.");
const { data: access, error: accessError } = await publicClient.from("clinic_memberships").select("role").eq("clinic_id", clinicId).eq("user_id", user.id).single();
await publicClient.auth.signOut();
if (accessError || access?.role !== "RECEPTION") throw new Error("Reception access verification failed.");
console.log("Demo account created and authenticated with reception access to the selected clinic.");
