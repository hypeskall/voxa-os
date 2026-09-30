import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { callerQuery, ids, migratedDatabase } from "./support/database";

const db=await migratedDatabase();
async function rpc<T>(uid:string,expression:string,args:unknown[]=[]){const {rows}=await callerQuery<{result:T}>(db,uid,`select ${expression} as result`,args);return rows[0].result;}

beforeAll(async()=>{await db.exec(readFileSync("supabase/seed-core.sql","utf8"));});
afterAll(async()=>db.close());

describe("administrative operations",()=>{
  it("returns a tenant-scoped operational dashboard",async()=>{
    const result=await rpc<Record<string,unknown>>(ids.owner,"public.operational_dashboard($1,$2)",[ids.a,"2026-09-29"]);
    expect(result).toMatchObject({date:"2026-09-29",can_view_schedule:true});
    expect(Array.isArray(result.upcoming)).toBe(true);
  });

  it("calculates reports server-side and restricts report access",async()=>{
    const report=await rpc<{summary:{total:number};resources:unknown[]}>(ids.owner,"public.reports_summary($1,$2,$3,$4,$5)",[ids.a,"2026-01-01","2026-12-31",null,null]);
    expect(report.summary.total).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(report.resources)).toBe(true);
    await expect(rpc(ids.reception,"public.reports_summary($1,$2,$3,$4,$5)",[ids.a,"2026-01-01","2026-01-31",null,null])).rejects.toThrow("Access denied");
  });

  it("searches only within the permitted clinic",async()=>{
    const results=await rpc<Array<{kind:string;href:string}>>(ids.reception,"public.global_search($1,$2,$3)",[ids.a,"Pacient",30]);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(item=>item.href.includes(ids.a))).toBe(true);
    await expect(rpc(ids.outsider,"public.global_search($1,$2,$3)",[ids.a,"Pacient",30])).rejects.toThrow("Access denied");
  });

  it("persists safe preferences under the caller's RLS identity",async()=>{
    await callerQuery(db,ids.owner,`insert into public.user_preferences(user_id,visible_columns,dashboard_modules) values($1,$2,$3) on conflict(user_id) do update set visible_columns=excluded.visible_columns,dashboard_modules=excluded.dashboard_modules`,[ids.owner,{patients:["internal_id"]},["metrics","alerts"]]);
    const {rows}=await callerQuery<{visible_columns:{patients:string[]};dashboard_modules:string[]}>(db,ids.owner,"select visible_columns,dashboard_modules from public.user_preferences where user_id=$1",[ids.owner]);
    expect(rows[0]).toEqual({visible_columns:{patients:["internal_id"]},dashboard_modules:["metrics","alerts"]});
  });

  it("records report exports in the immutable audit stream",async()=>{
    await rpc(ids.owner,"public.record_report_export($1,$2,$3)",[ids.a,"2026-01-01","2026-01-31"]);
    const {rows}=await callerQuery<{action:string;metadata:{format:string}}>(db,ids.owner,"select action,metadata from public.audit_logs where clinic_id=$1 and entity='reports' order by created_at desc limit 1",[ids.a]);
    expect(rows[0]).toMatchObject({action:"export",metadata:{format:"csv"}});
    await expect(callerQuery(db,ids.owner,"update public.audit_logs set action='tampered' where clinic_id=$1",[ids.a])).rejects.toThrow();
  });
});
