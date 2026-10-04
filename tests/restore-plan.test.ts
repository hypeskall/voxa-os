import { describe, expect, it } from "vitest";
// @ts-expect-error Node operator module.
import { canonicalRows, restoreTablePlan, qualifiedTable } from "../scripts/restore-plan.mjs";
// @ts-expect-error Node operator module.
import { isolatedRestoreConfiguration } from "../scripts/restore-isolated.mjs";

describe("full isolated restore planning", () => {
  it("preserves source hashes and escapes records while excluding provider-generated columns", () => {
    const plan = restoreTablePlan({name:"auth.users",rows:[{id:"test",encrypted_password:"$2b$restored",confirmed_at:"generated",email:"o'hara@test.invalid"}]},[{name:"id",generated:false},{name:"encrypted_password",generated:false},{name:"confirmed_at",generated:true},{name:"email",generated:false}]);
    expect(plan.fields).not.toContain("confirmed_at");
    expect(plan.sourceFields).toContain("confirmed_at");
    expect(plan.sql).toContain("o''hara@test.invalid");
    expect(plan.sql).toContain("$2b$restored");
    expect(plan.sql).toContain("overriding system value");
    expect(()=>qualifiedTable("auth.users;drop table users")).toThrow();
  });
  it("never silently loses populated provider data and retains the local provider migration history", () => {
    expect(()=>restoreTablePlan({name:"auth.sessions",rows:[{id:"session",new_field:"value"}]},[{name:"id"}])).toThrow(/missing populated column/);
    expect(()=>restoreTablePlan({name:"auth.sessions",rows:[{id:"session"}]},[])).toThrow(/missing populated table/);
    expect(restoreTablePlan({name:"auth.sessions",rows:[]},[])).toEqual({absentEmpty:true});
    expect(restoreTablePlan({name:"auth.schema_migrations",rows:[{version:"hosted"}]},[{name:"version"}])).toEqual({managed:true});
    expect(canonicalRows([{a:1,b:{d:2,c:3}}],["a","b"])).toBe(canonicalRows([{b:{c:3,d:2},a:1,extra:0}],["a","b"]));
  });
  it("rejects production archives and public/forked/scheduled restore runners before network access", () => {
    const env={GITHUB_ACTIONS:"true",GITHUB_REPOSITORY:"hypeskall/voxa-backup-runner",GITHUB_EVENT_NAME:"workflow_dispatch",PRIVATE_BACKUP_RUNNER_APPROVED:"true",STAGING_BACKUP_ENCRYPTION_KEY:"a".repeat(64),STAGING_SNAPSHOT_SHA256:"b".repeat(64),STAGING_SNAPSHOT_OBJECT_KEY:`voxa/wlnrfjrjkyywqyvsngps/2026-10-04/${"b".repeat(64)}.voxa`,R2_ACCESS_KEY_ID:"c".repeat(32),R2_SECRET_ACCESS_KEY:"d".repeat(64),CLOUDFLARE_API_TOKEN:"e".repeat(40)};
    const repo={full_name:env.GITHUB_REPOSITORY,private:true};
    expect(isolatedRestoreConfiguration(env,repo).objectKey).toBe(env.STAGING_SNAPSHOT_OBJECT_KEY);
    for(const changed of [{GITHUB_REPOSITORY:"hypeskall/voxa-os"},{GITHUB_EVENT_NAME:"schedule"},{STAGING_SNAPSHOT_OBJECT_KEY:env.STAGING_SNAPSHOT_OBJECT_KEY.replace("wlnrfjrjkyywqyvsngps","fibcbsdattoqiyizzeda")},{STAGING_BACKUP_ENCRYPTION_KEY:"wrong"}])expect(()=>isolatedRestoreConfiguration({...env,...changed},repo)).toThrow();
    expect(()=>isolatedRestoreConfiguration(env,{...repo,private:false})).toThrow();
  });
});
