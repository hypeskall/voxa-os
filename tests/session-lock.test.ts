import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { ids, migratedDatabase } from "./support/database";
let db: PGlite;
beforeAll(async () => { db = await migratedDatabase(true, undefined, true); });
afterAll(async () => { await db.close(); });
beforeEach(async () => {
  await db.exec("delete from private.session_activity; delete from auth.mfa_factors; update auth.sessions set created_at=now(),not_after=null");
});
async function call(sql: string, session = ids.owner, uid = ids.owner) {
  return db.transaction(async tx => {
    await tx.exec("set local role authenticated");
    await tx.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)", [uid, JSON.stringify({ session_id: session, aal: "aal2" })]);
    return tx.query<{ state: { allowed: boolean; fresh?: boolean; idleExpiresAt?: number }; id?: string }>(sql);
  });
}
describe("server-enforced idle sessions", () => {
  it("requires a real session belonging to the signed-in user", async () => {
    expect((await call("select public.session_status(false) state", ids.outsider)).rows[0].state.allowed).toBe(false);
    expect((await call("select public.session_status(false) state", "90000000-0000-4000-8000-000000000001")).rows[0].state.allowed).toBe(false);
    expect((await call("select public.session_status(false) state")).rows[0].state).toMatchObject({ allowed: true, fresh: true });
    await expect(call("update private.session_activity set last_activity_at=now()")).rejects.toThrow(/permission denied/);
  });
  it("does not let background checks extend inactivity", async () => {
    await call("select public.session_status(false) state");
    await db.exec("update private.session_activity set last_activity_at=now()-interval '9 minutes'");
    const before = (await db.query("select last_activity_at from private.session_activity")).rows;
    await call("select public.session_status(false) state");
    expect((await db.query("select last_activity_at from private.session_activity")).rows).toEqual(before);
    const continued = (await call("select public.session_status(true) state")).rows[0].state;
    expect(continued.allowed).toBe(true);
    expect(continued.idleExpiresAt! - Date.now()).toBeGreaterThan(590000);
  });
  it("blocks tables and RPCs at ten minutes even with an AAL2 token", async () => {
    await call("select public.session_status(false) state");
    await db.exec("update private.session_activity set last_activity_at=now()-interval '10 minutes'");
    expect((await call("select id from public.clinics")).rows).toEqual([]);
    await expect(call("select public.record_login()" )).rejects.toThrow(/MFA/);
    expect((await call("select public.session_status(true) state")).rows[0].state.allowed).toBe(false);
    expect((await call("select public.session_status(true) state")).rows[0].state.allowed).toBe(false);
  });
  it("denies revoked and provider-expired sessions immediately", async () => {
    await call("select public.session_status(false) state");
    await db.query("delete from auth.sessions where id=$1", [ids.owner]);
    expect((await call("select id from public.clinics")).rows).toEqual([]);
    expect((await call("select public.session_status(true) state")).rows[0].state.allowed).toBe(false);
    await db.query("insert into auth.sessions(id,user_id,not_after) values($1,$1,now()-interval '1 second')", [ids.owner]);
    expect((await call("select public.session_status(false) state")).rows[0].state.allowed).toBe(false);
  });
  it("caps the session at eight hours regardless of recent activity", async () => {
    await db.query("update auth.sessions set created_at=now()-interval '8 hours' where id=$1", [ids.owner]);
    expect((await call("select public.session_status(true) state")).rows[0].state.allowed).toBe(false);
  });
  it("requires a recent sign-in for exports and MFA policy changes", async () => {
    await call("select public.session_status(false) state");
    await db.exec("update private.session_activity set started_at=now()-interval '6 minutes'");
    expect((await call("select public.session_status(false) state")).rows[0].state).toMatchObject({ allowed: true, fresh: false });
    await expect(call(`select public.export_patient('${ids.a}',gen_random_uuid())`)).rejects.toThrow(/Fresh authentication/);
    await expect(call(`select public.record_report_export('${ids.a}',current_date,current_date)`)).rejects.toThrow(/Fresh authentication/);
    await expect(call(`select public.set_organization_mfa_policy('${ids.a}',true)`)).rejects.toThrow(/Fresh authentication/);
  });
});
