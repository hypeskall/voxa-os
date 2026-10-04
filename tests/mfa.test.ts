import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { callerQuery, ids, migratedDatabase } from "./support/database";
import { safeMfaDestination, mfaCodeSchema } from "../src/features/auth/mfa-model";

let db: PGlite;
beforeAll(async () => { db = await migratedDatabase(true); });
afterAll(async () => { await db.close(); });

describe("optional enrolled MFA protects every private entry point", () => {
  it("keeps ordinary and unfinished enrollment access, then blocks tables, RPCs and Storage at AAL1", async () => {
    expect((await callerQuery(db, ids.owner, "select id from public.clinics")).rows).toHaveLength(2);
    const factor = (await db.query<{id:string}>("insert into auth.mfa_factors(user_id,status) values($1,'unverified') returning id", [ids.owner])).rows[0].id;
    expect((await callerQuery(db, ids.owner, "select id from public.clinics")).rows).toHaveLength(2);
    await db.query("update auth.mfa_factors set status='verified' where id=$1", [factor]);
    for (const table of ["clinics", "profiles", "user_preferences", "clinic_memberships"])
      expect((await callerQuery(db, ids.owner, `select * from public.${table}`)).rows).toHaveLength(0);
    await expect(callerQuery(db, ids.owner, "update public.profiles set full_name='Forbidden' returning id")).resolves.toHaveProperty("rows", []);
    await expect(callerQuery(db, ids.owner, "select public.record_login()")).rejects.toThrow("MFA verification required");
    await expect(callerQuery(db, ids.owner, "select public.create_organization('Forbidden','Forbidden')")).rejects.toThrow("MFA verification required");
    await expect(callerQuery(db, ids.owner, "select public.find_conflicts($1,'{}'::jsonb)", [ids.a])).rejects.toThrow("MFA verification required");
    await expect(callerQuery(db, ids.owner, "select public.can_delete_unregistered_medical_object('synthetic-test.pdf')")).rejects.toThrow("MFA verification required");
    expect((await callerQuery(db, ids.owner, "select public.my_permissions($1)", [ids.a])).rows).toHaveLength(0);
    // Prove the restrictive Storage policy blocks even an otherwise permissive policy.
    await db.exec("create policy mfa_test_permissive on storage.objects for select to authenticated using(true)");
    await db.query("insert into storage.objects(bucket_id,name) values('voxa-medical','synthetic-test.pdf')");
    expect((await callerQuery(db, ids.owner, "select id from storage.objects")).rows).toHaveLength(0);
    await db.transaction(async tx => {
      await tx.exec("set local role authenticated");
      await tx.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)", [ids.owner, JSON.stringify({aal:"aal2"})]);
      expect((await tx.query("select id from public.clinics")).rows).toHaveLength(2);
      expect((await tx.query("select public.my_permissions($1)", [ids.a])).rows.length).toBeGreaterThan(0);
      expect((await tx.query("select public.record_login()")).rows).toHaveLength(1);
      expect((await tx.query("select id from public.clinics where id=$1", [ids.c])).rows).toHaveLength(0);
      expect((await tx.query("select id from storage.objects")).rows).toHaveLength(1);
    });
    // A second account is unaffected by the owner's enrollment.
    expect((await callerQuery(db, ids.outsider, "select id from public.clinics")).rows).toHaveLength(1);
    await db.query("delete from auth.mfa_factors where id=$1", [factor]);
    expect((await callerQuery(db, ids.owner, "select id from public.clinics")).rows).toHaveLength(2);
  });
  it("requires a restrictive MFA policy on every application table and guards every authenticated PL/pgSQL RPC", async () => {
    const missing = await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity and not exists(select 1 from pg_policy p where p.polrelid=c.oid and p.polname='mfa_required' and not p.polpermissive)`);
    expect(missing.rows).toEqual([]);
    const unguarded = await db.query(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang where n.nspname='public' and l.lanname='plpgsql' and has_function_privilege('authenticated',p.oid,'execute') and position('perform private.require_mfa();' in p.prosrc)=0`);
    expect(unguarded.rows).toEqual([]);
    const unguardedSql = await db.query(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang where n.nspname='public' and l.lanname='sql' and p.prosecdef and has_function_privilege('authenticated',p.oid,'execute') and not has_function_privilege('anon',p.oid,'execute') and position('private.mfa_satisfied()' in p.prosrc)=0`);
    expect(unguardedSql.rows).toEqual([]);
    await expect(callerQuery(db, ids.owner, "select * from auth.mfa_factors")).rejects.toThrow(/permission denied/);
  });
  it("rejects MFA redirect loops, external destinations and malformed codes", () => {
    for (const value of ["//evil.test", "https://evil.test", "/auth/mfa", "/login", "/dashboard?next=https://evil.test"])
      expect(safeMfaDestination(value)).toBe("/dashboard");
    expect(safeMfaDestination("/reset-password")).toBe("/reset-password");
    expect(mfaCodeSchema.safeParse("012345").success).toBe(true);
    expect(mfaCodeSchema.safeParse("12345a").success).toBe(false);
  });
});
