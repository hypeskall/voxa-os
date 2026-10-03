import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { randomBytes, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { migratedDatabase, callerQuery, ids } from "./support/database";
import {
  remainingTrialDays,
  LICENSE_PATTERN,
  normalizeLicense,
} from "../src/features/subscriptions/model";
let db: PGlite;
const query = <T = Record<string, unknown>>(
  uid: string,
  sql: string,
  args: unknown[] = [],
) => callerQuery<T>(db, uid, sql, args);
const access = async () =>
  (
    await query<{ allowed: boolean }>(
      ids.owner,
      "select public.organization_access($1) allowed",
      [ids.org],
    )
  ).rows[0].allowed;
async function issue(
  organization: string | null = null,
  deadline = new Date(Date.now() + 86400000).toISOString(),
) {
  const code = `VOXA-${randomBytes(16).toString("hex").toUpperCase().match(/.{4}/g)!.join("-")}`;
  const digest = createHash("sha256").update(code).digest("hex");
  const id = await db.transaction(async (tx) => {
    await tx.exec(
      "set local role service_role; select set_config('request.jwt.claim.role','service_role',true)",
    );
    return (
      await tx.query<{ id: string }>(
        "select public.issue_license($1,$2,$3,1,$4) id",
        [digest, code.slice(-4), organization, deadline],
      )
    ).rows[0].id;
  });
  return { code, digest, id };
}
async function activate(digest: string, uid = ids.owner, oid = ids.org) {
  return (
    await query<{ activated: boolean }>(
      uid,
      "select public.activate_license($1,$2) activated",
      [oid, digest],
    )
  ).rows[0].activated;
}
async function expire() {
  await db.query(
    "update public.organization_subscriptions set trial_started_at=now()-interval '31 days',trial_ends_at=now()-interval '1 day' where organization_id=$1",
    [ids.org],
  );
}
beforeAll(async () => {
  db = await migratedDatabase(true);
  await db.exec(readFileSync("supabase/seed-core.sql", "utf8"));
});
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  await db.query(
    "update public.organization_subscriptions set status='trialing',trial_started_at=now(),trial_ends_at=now()+interval '30 days',license_key_id=null,entitlement_source=null,current_period_start=null,current_period_end=null,ended_at=null,cancel_at_period_end=false where organization_id=$1",
    [ids.org],
  );
  await db.query(
    "delete from private.license_activation_attempts where organization_id=$1",
    [ids.org],
  );
});
describe("organization subscription database enforcement", () => {
  it("starts exactly one 30-day trial on creation and preserves tenant isolation", async () => {
    const created = (
      await db.query<{ id: string }>(
        "insert into public.organizations(name,trial_started_at,trial_ends_at) values('Fresh trial',now()-interval '100 days',now()+interval '100 years') returning id",
      )
    ).rows[0].id;
    const fresh = (
      await db.query<{
        status: string;
        seconds: number;
        trial_ends_at: string;
      }>(
        "select status,extract(epoch from trial_ends_at-trial_started_at) seconds,trial_ends_at from public.organization_subscriptions where organization_id=$1",
        [created],
      )
    ).rows;
    expect(fresh).toHaveLength(1);
    expect(fresh[0].status).toBe("trialing");
    expect(Number(fresh[0].seconds)).toBe(30 * 86400);
    await db.query(
      "update public.organizations set name='Renamed clinic' where id=$1",
      [created],
    );
    expect(
      (
        await db.query<{ trial_ends_at: string }>(
          "select trial_ends_at from public.organization_subscriptions where organization_id=$1",
          [created],
        )
      ).rows[0].trial_ends_at,
    ).toEqual(fresh[0].trial_ends_at);
    expect(
      (
        await db.query(
          "select id from public.subscription_events where organization_id=$1 and event_type='trial_started'",
          [created],
        )
      ).rows,
    ).toHaveLength(1);
    const s = (
      await db.query<{ status: string; seconds: number }>(
        "select status,extract(epoch from trial_ends_at-trial_started_at) seconds from public.organization_subscriptions where organization_id=$1",
        [ids.org],
      )
    ).rows[0];
    expect(s.status).toBe("trialing");
    expect(Number(s.seconds)).toBe(30 * 86400);
    expect(await access()).toBe(true);
    expect(
      (
        await query(
          ids.owner,
          "select * from public.organization_subscriptions",
        )
      ).rows,
    ).toHaveLength(1);
    await expect(
      query(ids.outsider, "select public.organization_access($1)", [ids.org]),
    ).rejects.toThrow("Access denied");
    await expect(
      query(
        ids.owner,
        "update public.organization_subscriptions set status='inactive'",
      ),
    ).rejects.toThrow();
    await expect(
      query(
        ids.owner,
        "update public.organizations set trial_ends_at=now()+interval '100 years'",
      ),
    ).rejects.toThrow();
  });
  it("blocks expired data reads, writes, SECURITY DEFINER RPCs and medical storage", async () => {
    await expire();
    expect(await access()).toBe(false);
    expect(
      (await query(ids.owner, "select * from public.patients")).rows,
    ).toHaveLength(0);
    expect(
      (await query(ids.owner, "select public.my_permissions($1)", [ids.a]))
        .rows,
    ).toHaveLength(0);
    await expect(
      query(ids.owner, "select public.list_core($1,'patients')", [ids.a]),
    ).rejects.toThrow("Access denied");
    await expect(
      query(
        ids.owner,
        "insert into public.patients(organization_id,clinic_id,name,internal_id) values($1,$2,'Blocked','BLOCKED')",
        [ids.org, ids.a],
      ),
    ).rejects.toThrow();
    const patient = (
      await db.query<{ id: string }>(
        "select id from public.patients where clinic_id=$1 limit 1",
        [ids.a],
      )
    ).rows[0].id;
    await expect(
      query(
        ids.owner,
        "insert into storage.objects(bucket_id,name) values('voxa-medical',$1)",
        [`${ids.a}/${patient}/documents/blocked.pdf`],
      ),
    ).rejects.toThrow();
    expect(
      (
        await db.query("select id from public.patients where clinic_id=$1", [
          ids.a,
        ])
      ).rows.length,
    ).toBeGreaterThan(0);
    expect(
      (
        await query(
          ids.owner,
          "select * from public.organization_subscriptions",
        )
      ).rows,
    ).toHaveLength(1);
    await access();
    expect(
      (
        await db.query(
          "select id from public.subscription_events where organization_id=$1 and event_type='trial_expired' and created_at>(select updated_at-interval '1 second' from public.organization_subscriptions where organization_id=$1)",
          [ids.org],
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("grants paid access only through a secure, one-use assigned license", async () => {
    await expire();
    const l = await issue(ids.org);
    expect(LICENSE_PATTERN.test(l.code)).toBe(true);
    expect(normalizeLicense(` ${l.code.toLowerCase()} `)).toBe(l.code);
    expect(await activate(l.digest, ids.outsider, ids.otherOrg)).toBe(false);
    expect(await activate(l.digest)).toBe(true);
    expect(await access()).toBe(true);
    expect(await activate(l.digest)).toBe(false);
    const s = (
      await query<{ status: string; entitlement_source: string }>(
        ids.owner,
        "select status,entitlement_source from public.organization_subscriptions",
      )
    ).rows[0];
    expect(s).toEqual({ status: "active", entitlement_source: "license" });
    expect(
      (await query(ids.owner, "select * from public.patients")).rows.length,
    ).toBeGreaterThan(0);
    await expect(
      query(ids.owner, "select code_hash from public.license_keys"),
    ).rejects.toThrow();
    expect(
      JSON.stringify(
        (await query(ids.owner, "select * from public.subscription_events"))
          .rows,
      ),
    ).not.toContain(l.code);
  });
  it("rejects invalid, expired, revoked and other-tenant licenses", async () => {
    expect(await activate("0".repeat(64))).toBe(false);
    const expired = await issue();
    await db.query(
      "update public.license_keys set redeem_by=now()-interval '1 day' where id=$1",
      [expired.id],
    );
    expect(await activate(expired.digest)).toBe(false);
    const revoked = await issue();
    await db.query(
      "update public.license_keys set status='revoked' where id=$1",
      [revoked.id],
    );
    expect(await activate(revoked.digest)).toBe(false);
    const other = await issue(ids.otherOrg);
    expect(await activate(other.digest)).toBe(false);
    await expect(
      activate((await issue()).digest, ids.reception),
    ).rejects.toThrow("Access denied");
    await expect(activate((await issue()).digest, ids.admin)).rejects.toThrow(
      "Access denied",
    );
  });
  it("rate limits persisted invalid attempts", async () => {
    const l = await issue();
    for (let i = 0; i < 10; i++)
      expect(await activate("0".repeat(64))).toBe(false);
    expect(await activate(l.digest)).toBe(false);
    await db.query(
      "update private.license_activation_attempts set window_started_at=now()-interval '16 minutes' where organization_id=$1",
      [ids.org],
    );
    expect(await activate(l.digest)).toBe(true);
  });
  it("retains paid days on early renewal and gates the exact expiry boundary", async () => {
    const first = await issue();
    expect(await activate(first.digest)).toBe(true);
    const before = (
      await db.query<{ until: string }>(
        "select current_period_end until from public.organization_subscriptions where organization_id=$1",
        [ids.org],
      )
    ).rows[0].until;
    expect(await activate((await issue()).digest)).toBe(true);
    const after = (
      await db.query<{ until: string }>(
        "select current_period_end until from public.organization_subscriptions where organization_id=$1",
        [ids.org],
      )
    ).rows[0].until;
    expect(Date.parse(after) - Date.parse(before)).toBeGreaterThan(
      27 * 86400000,
    );
    await db.query(
      "update public.organization_subscriptions set current_period_start=now()-interval '31 days',current_period_end=now() where organization_id=$1",
      [ids.org],
    );
    expect(await access()).toBe(false);
  });
  it("revokes access immediately and prohibits tenant license issuance", async () => {
    const l = await issue();
    await activate(l.digest);
    await expect(
      query(ids.owner, "select public.issue_license($1,'ABCD')", [
        "a".repeat(64),
      ]),
    ).rejects.toThrow();
    await expect(
      query(ids.owner, "select public.revoke_license($1)", [l.id]),
    ).rejects.toThrow();
    await db.transaction(async (tx) => {
      await tx.exec(
        "set local role service_role; select set_config('request.jwt.claim.role','service_role',true)",
      );
      await tx.query("select public.revoke_license($1)", [l.id]);
    });
    expect(await access()).toBe(false);
  });
  it("restricts all billing data to the active owner", async () => {
    for (const uid of [ids.admin, ids.reception, ids.doctor, ids.outsider]) {
      expect(
        (
          await query(
            uid,
            "select * from public.organization_subscriptions where organization_id=$1",
            [ids.org],
          )
        ).rows,
      ).toHaveLength(0);
      expect(
        (
          await query(
            uid,
            "select * from public.subscription_events where organization_id=$1",
            [ids.org],
          )
        ).rows,
      ).toHaveLength(0);
    }
  });
  it("blocks public booking for expired tenants and restores it on activation", async () => {
    await db.query(
      "update public.clinics set public_booking_enabled=true,booking_slug='subscription-test' where id=$1",
      [ids.a],
    );
    await expire();
    await expect(
      db.query("select public.public_booking_catalog('subscription-test')"),
    ).rejects.toThrow("Booking unavailable");
    await expect(
      db.query(
        "select public.create_public_booking('subscription-test','{}','')",
      ),
    ).rejects.toThrow("Booking unavailable");
    expect(await activate((await issue()).digest)).toBe(true);
    expect(
      (
        await db.query<{ catalog: unknown }>(
          "select public.public_booking_catalog('subscription-test') catalog",
        )
      ).rows[0].catalog,
    ).toBeTruthy();
  });
});
it("calculates remaining trial days without a negative or phantom day", () => {
  const time = Date.parse("2026-10-03T00:00:00Z");
  expect(remainingTrialDays("2026-10-04T00:00:00Z", time)).toBe(1);
  expect(remainingTrialDays("2026-10-03T00:00:00Z", time)).toBe(0);
  expect(remainingTrialDays("2026-10-01T00:00:00Z", time)).toBe(0);
});
it("backfills existing dates without extending trials or treating legacy active flags as paid", async () => {
  const legacy = await migratedDatabase(
    false,
    "202610030031_whatsapp_patient_communications.sql",
  );
  try {
    await legacy.query(
      "update public.organizations set trial_started_at=now()-interval '31 days',trial_ends_at=now()-interval '1 day',subscription_status='active' where id=$1",
      [ids.org],
    );
    const old = (
      await legacy.query<{ trial_ends_at: string }>(
        "select trial_ends_at from public.organizations where id=$1",
        [ids.org],
      )
    ).rows[0].trial_ends_at;
    await legacy.exec(
      readFileSync(
        "supabase/migrations/202610030032_subscriptions_and_licenses.sql",
        "utf8",
      ),
    );
    const backfill = (
      await legacy.query<{ status: string; trial_ends_at: string }>(
        "select status,trial_ends_at from public.organization_subscriptions where organization_id=$1",
        [ids.org],
      )
    ).rows[0];
    expect(backfill).toEqual({ status: "expired", trial_ends_at: old });
    expect(
      (
        await callerQuery<{ allowed: boolean }>(
          legacy,
          ids.owner,
          "select public.organization_access($1) allowed",
          [ids.org],
        )
      ).rows[0].allowed,
    ).toBe(false);
  } finally {
    await legacy.close();
  }
});
