import { describe, expect, it, vi } from "vitest";
// @ts-expect-error Operator-only Node module has no declarations.
import { backupRunConfiguration, executeBackup } from "../scripts/backup-run.mjs";
// @ts-expect-error Operator-only Node module has no declarations.
import { snapshotHash } from "../scripts/snapshot-codec.mjs";

const ref="fibcbsdattoqiyizzeda";
const source={NEXT_PUBLIC_SUPABASE_URL:`https://${ref}.supabase.co`,APP_ORIGIN:"https://voxa-os.vercel.app",BACKUP_ENCRYPTION_KEY:"a".repeat(64)};
const destination={R2_UPLOAD_APPROVED:"true",R2_APPROVED_PROJECT_REF:ref,R2_ACCOUNT_ID:"a".repeat(32),R2_BUCKET:"voxa-private-backups",R2_JURISDICTION:"eu",R2_ACCESS_KEY_ID:"b".repeat(32),R2_SECRET_ACCESS_KEY:"c".repeat(64),CLOUDFLARE_API_TOKEN:"d".repeat(40)};
const config=backupRunConfiguration(".env.production.local",source,destination);
const createdAt="2026-10-04T12:00:00.000Z";
const bytes=config.codec.seal({format:1,ref,createdAt,tables:[],objects:[]});
const hash=snapshotHash(bytes);
const now=()=>Date.parse("2026-10-04T12:10:00.000Z");
function io() { return {checkPrivacy:vi.fn().mockResolvedValue(undefined),capture:vi.fn().mockResolvedValue(undefined),
  readReceipt:vi.fn().mockResolvedValue({ref,createdAt,path:".backups/synthetic.voxa",verified:true,sha256:hash}),
  readArchive:vi.fn().mockResolvedValue(bytes),upload:vi.fn().mockResolvedValue({ref,sha256:hash,verified:true}),writeReceipt:vi.fn().mockResolvedValue(undefined)}; }

describe("fresh approved backup orchestration",()=>{
  it("rejects foreign source URLs, incorrect origin, absent destination approval and mismatched projects before access",()=>{
    for(const changed of [{...source,NEXT_PUBLIC_SUPABASE_URL:`https://${ref}.supabase.co.evil.invalid`},{...source,APP_ORIGIN:"https://foreign.invalid"}])
      expect(()=>backupRunConfiguration(".env.production.local",changed,destination)).toThrow();
    expect(()=>backupRunConfiguration(".env.staging.local",source,destination)).toThrow();
    for(const changed of [{...destination,R2_UPLOAD_APPROVED:"false"},{...destination,R2_APPROVED_PROJECT_REF:"wlnrfjrjkyywqyvsngps"}])
      expect(()=>backupRunConfiguration(".env.production.local",source,changed)).toThrow();
  });
  it("refuses to capture private records when destination privacy cannot be established",async()=>{
    const mock=io();mock.checkPrivacy.mockRejectedValue(new Error("public"));
    await expect(executeBackup(config,mock,now)).rejects.toThrow();
    expect(mock.capture).not.toHaveBeenCalled();expect(mock.upload).not.toHaveBeenCalled();
  });
  it("rejects stale, future, foreign or unverified capture receipts before upload",async()=>{
    for(const patch of [{createdAt:"2026-10-03T00:00:00Z"},{createdAt:"2026-10-05T00:00:00Z"},{createdAt:"invalid"},{ref:"wlnrfjrjkyywqyvsngps"},{verified:false}]) {
      const mock=io();mock.readReceipt.mockResolvedValue({ref,createdAt,path:".backups/synthetic.voxa",verified:true,sha256:hash,...patch});
      await expect(executeBackup(config,mock,now)).rejects.toThrow();expect(mock.upload).not.toHaveBeenCalled();
    }
  });
  it("detects authenticated archive replacement and mismatched capture hash before transmission",async()=>{
    const mock=io();mock.readArchive.mockResolvedValue(config.codec.seal({format:1,ref,createdAt,tables:[],objects:[]}));
    await expect(executeBackup(config,mock,now)).rejects.toThrow();expect(mock.upload).not.toHaveBeenCalled();
  });
  it("writes external evidence only after matching verified download and refuses failed transfers",async()=>{
    const mock=io();await expect(executeBackup(config,mock,now)).resolves.toMatchObject({verified:true});expect(mock.writeReceipt).toHaveBeenCalledOnce();
    for(const result of [{ref,verified:false,sha256:hash},{ref,verified:true,sha256:"b".repeat(64)}]) {
      const broken=io();broken.upload.mockResolvedValue(result);await expect(executeBackup(config,broken,now)).rejects.toThrow();expect(broken.writeReceipt).not.toHaveBeenCalled();
    }
    const failure=io();failure.upload.mockRejectedValue(new Error("private diagnostic"));await expect(executeBackup(config,failure,now)).rejects.toThrow();expect(failure.writeReceipt).not.toHaveBeenCalled();
  });
});
