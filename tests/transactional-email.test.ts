import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migratedDatabase } from "./support/database";

describe("durable SMTP acknowledgements",()=>{
  let db:Awaited<ReturnType<typeof migratedDatabase>>;
  beforeAll(async()=>{db=await migratedDatabase();});
  afterAll(async()=>{await db.close();});
  const service=(sql:string,args:unknown[]=[])=>db.transaction(async(tx)=>{
    await tx.exec("set local role service_role");
    await tx.query("select set_config('request.jwt.claims','{\"role\":\"service_role\"}',true)");
    return tx.query<{status:string}>(sql,args);
  });
  it("denies tenant and anonymous claims and refuses forged role-less service calls",async()=>{
    for(const role of ["anon","authenticated"]) await expect(db.transaction(async(tx)=>{
      await tx.exec(`set local role ${role}`);
      await tx.query("select public.claim_transactional_email($1)",["a".repeat(64)]);
    })).rejects.toThrow(/permission denied/);
    await expect(db.query("select public.claim_transactional_email($1)",["a".repeat(64)])).rejects.toThrow(/Service role required/);
  });
  it("reserves once, refuses concurrent resend, and reuses only a confirmed acceptance",async()=>{
    const digest="b".repeat(64);
    expect((await service("select public.claim_transactional_email($1) status",[digest])).rows[0].status).toBe("claimed");
    expect((await service("select public.claim_transactional_email($1) status",[digest])).rows[0].status).toBe("sending");
    await service("select public.finish_transactional_email($1,'accepted')",[digest]);
    expect((await service("select public.claim_transactional_email($1) status",[digest])).rows[0].status).toBe("accepted");
  });
  it("keeps uncertain outcomes blocked even after a later worker retry",async()=>{
    const digest="c".repeat(64);
    await service("select public.claim_transactional_email($1)",[digest]);
    await service("select public.finish_transactional_email($1,'uncertain')",[digest]);
    expect((await service("select public.claim_transactional_email($1) status",[digest])).rows[0].status).toBe("uncertain");
    await expect(service("select public.finish_transactional_email($1,'accepted')",[digest])).rejects.toThrow(/unavailable/);
    await expect(service("select public.claim_transactional_email('invalid')")).rejects.toThrow(/Invalid digest/);
  });
});
