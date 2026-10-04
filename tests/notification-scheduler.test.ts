import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { migratedDatabase, ids } from "./support/database";

describe("notification scheduler and retry boundaries", () => {
  let db: Awaited<ReturnType<typeof migratedDatabase>>;
  beforeAll(async () => { db = await migratedDatabase(); });
  afterAll(async () => { await db.close(); });
  async function service<T>(sql: string, args: unknown[] = []) {
    return db.transaction(async (tx) => {
      await tx.exec("set local role service_role");
      await tx.query("select set_config('request.jwt.claims','{\"role\":\"service_role\"}',true)");
      return tx.query<T>(sql, args);
    });
  }
  it("keeps patient delivery unscheduled in Vercel and GitHub", () => {
    expect(JSON.parse(readFileSync("vercel.json", "utf8")).crons).toEqual([]);
    const workflow = readFileSync(".github/workflows/notification-worker.yml", "utf8");
    expect(workflow).not.toMatch(/\bschedule:/);
    expect(workflow).toContain("workflow_dispatch:");
  });
  it("rejects scheduler configuration and dispatch for client roles", async () => {
    for (const role of ["anon", "authenticated"]) {
      await expect(db.transaction(async (tx) => {
        await tx.exec(`set local role ${role}`);
        await tx.query("select public.configure_notification_scheduler($1,$2)", ["https://example.test", "a".repeat(32)]);
      })).rejects.toThrow(/permission denied/);
    }
    await expect(service("select private.dispatch_notification_worker()" )).rejects.toThrow(/permission denied/);
  });
  it("reports missing local extensions rather than activating a fake scheduler", async () => {
    await expect(service("select public.configure_notification_scheduler($1,$2)", ["https://example.test", "a".repeat(32)]))
      .rejects.toThrow(/Supabase Cron, pg_net and Vault are required/);
    await expect(service("select public.configure_notification_scheduler($1,$2)", ["http://localhost:3000", "a".repeat(32)]))
      .rejects.toThrow(/HTTPS origin/);
  });
  it("retries with the same key, excludes leased jobs, and never reclaims sent jobs", async () => {
    const id = "a1000000-0000-4000-8000-000000000001";
    await db.query(`insert into public.notification_jobs(id,organization_id,clinic_id,event,channel,recipient,idempotency_key)
      values($1,$2,$3,'APPOINTMENT_REMINDER','EMAIL','demo@example.test','scheduler-retry-test')`, [id, ids.org, ids.a]);
    const first = await service<{ jobs: { id: string; idempotency_key: string }[] }>("select public.claim_notification_jobs(25) jobs");
    expect(first.rows[0].jobs).toHaveLength(1);
    expect((await service<{ jobs: unknown[] }>("select public.claim_notification_jobs(25) jobs")).rows[0].jobs).toEqual([]);
    await db.query("update public.notification_jobs set locked_at=now()-interval '16 minutes' where id=$1", [id]);
    const recovered = await service<{ jobs: { idempotency_key: string }[] }>("select public.claim_notification_jobs(25) jobs");
    expect(recovered.rows[0].jobs[0].idempotency_key).toBe(first.rows[0].jobs[0].idempotency_key);
    await service("select public.finish_notification_job($1,'FAILED','','Temporary failure')", [id]);
    await db.query("update public.notification_jobs set scheduled_for=now()-interval '1 minute' where id=$1", [id]);
    const retry = await service<{ jobs: { id: string; idempotency_key: string }[] }>("select public.claim_notification_jobs(25) jobs");
    expect(retry.rows[0].jobs[0].idempotency_key).toBe(first.rows[0].jobs[0].idempotency_key);
    await service("select public.finish_notification_job($1,'SENT','provider-1','')", [id]);
    expect((await service<{ jobs: unknown[] }>("select public.claim_notification_jobs(25) jobs")).rows[0].jobs).toEqual([]);
  });
});
