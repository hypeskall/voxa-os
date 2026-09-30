import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
export const ids = {
  owner: "10000000-0000-4000-8000-000000000001",
  admin: "10000000-0000-4000-8000-000000000002",
  reception: "10000000-0000-4000-8000-000000000003",
  doctor: "10000000-0000-4000-8000-000000000004",
  outsider: "10000000-0000-4000-8000-000000000006",
  org: "20000000-0000-4000-8000-000000000001",
  otherOrg: "20000000-0000-4000-8000-000000000002",
  a: "30000000-0000-4000-8000-000000000001",
  b: "30000000-0000-4000-8000-000000000002",
  c: "30000000-0000-4000-8000-000000000003",
};
export async function migratedDatabase() {
  const db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
  for (const file of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  for (const name of [
    "owner",
    "admin",
    "reception",
    "doctor",
    "outsider",
  ] as const)
    await db.query("insert into auth.users(id,email) values($1,$2)", [
      ids[name],
      `${name}@voxa.test`,
    ]);
  await db.query(
    "insert into public.organizations(id,name) values($1,'Test organization'),($2,'Other organization')",
    [ids.org, ids.otherOrg],
  );
  await db.query(
    "insert into public.clinics(id,organization_id,name) values($1,$2,'Clinic A'),($3,$2,'Clinic B'),($4,$5,'Clinic C')",
    [ids.a, ids.org, ids.b, ids.c, ids.otherOrg],
  );
  for (const name of ["owner", "admin", "reception", "doctor"] as const)
    await db.query(
      "insert into public.clinic_memberships(user_id,organization_id,clinic_id,role) values($1,$2,$3,$4)",
      [ids[name], ids.org, ids.a, name.toUpperCase()],
    );
  await db.query(
    "insert into public.clinic_memberships(user_id,organization_id,clinic_id,role) values($1,$2,$3,'OWNER'),($4,$5,$6,'OWNER')",
    [ids.owner, ids.org, ids.b, ids.outsider, ids.otherOrg, ids.c],
  );
  return db;
}
// Every call commits or rolls back atomically and uses the actual authenticated
// database role. PGlite serializes transactions on its single connection.
export async function callerQuery<T>(
  db: PGlite,
  uid: string,
  sql: string,
  args: unknown[] = [],
) {
  return db.transaction(async (tx) => {
    await tx.exec("set local role authenticated");
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [uid]);
    return tx.query<T>(sql, args);
  });
}
