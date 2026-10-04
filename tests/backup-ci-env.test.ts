import { describe, expect, it } from "vitest";
// @ts-expect-error Operator module has no declarations.
import { privateBackupFiles } from "../scripts/backup-ci-env.mjs";

const repository = { full_name: "hypeskall/voxa-backup-runner", private: true };
const service = `eyJ.test.${"a".repeat(40)}`;
const env = {
  GITHUB_REPOSITORY: repository.full_name, GITHUB_EVENT_NAME: "workflow_dispatch", PRIVATE_BACKUP_RUNNER_APPROVED: "true",
  SUPABASE_BACKUP_READ_TOKEN: "sbp_fc_synthetic_scoped_token",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_synthetic_storage_key", BACKUP_ENCRYPTION_KEY: "a".repeat(64),
  R2_ACCESS_KEY_ID: "b".repeat(32), R2_SECRET_ACCESS_KEY: "c".repeat(64), CLOUDFLARE_API_TOKEN: "d".repeat(40),
  SUPABASE_ACCESS_TOKEN: "classic-operator-must-never-export", SMTP_PASSWORD: "mail-secret-must-never-export",
};

describe("private scheduled backup credential boundary", () => {
  it("rejects public/foreign repositories, pull requests and absent operator approval", () => {
    for (const changed of [{ ...repository, private: false }, { ...repository, full_name: "hypeskall/voxa-os" }])
      expect(() => privateBackupFiles(env, changed)).toThrow();
    for (const changed of [{ ...env, GITHUB_EVENT_NAME: "pull_request" }, { ...env, PRIVATE_BACKUP_RUNNER_APPROVED: "false" }, { ...env, GITHUB_REPOSITORY: "foreign/runner" }])
      expect(() => privateBackupFiles(changed, repository)).toThrow();
  });
  it("requires a scoped token and rejects malformed or foreign Storage keys", () => {
    for (const token of ["sbp_classic_token", "", "sbp_fc_token\nINJECTION=true"])
      expect(() => privateBackupFiles({ ...env, SUPABASE_BACKUP_READ_TOKEN: token }, repository)).toThrow();
    const foreignClaims = Buffer.from(JSON.stringify({ role: "service_role", ref: "wlnrfjrjkyywqyvsngps" })).toString("base64url");
    for (const key of [service, `eyJ.${foreignClaims}.sig`, "sb_secret_placeholder", "sb_secret_key\nINJECTION=true"])
      expect(() => privateBackupFiles({ ...env, SUPABASE_SERVICE_ROLE_KEY: key }, repository)).toThrow();
  });
  it("exports only the approved credential subset and exact production/EU destination", () => {
    const files = privateBackupFiles(env, repository);
    expect(Object.keys(files)).toEqual([".env.production.local", ".env.backup.local"]);
    const serialized = Object.values(files).join("\n");
    expect(serialized).not.toContain(env.SUPABASE_ACCESS_TOKEN);
    expect(serialized).not.toContain(env.SMTP_PASSWORD);
    expect(serialized).toContain(`SUPABASE_ACCESS_TOKEN=${env.SUPABASE_BACKUP_READ_TOKEN}`);
    expect(serialized).toContain("R2_BUCKET=voxa-private-backups");
    expect(serialized).toContain("R2_JURISDICTION=eu");
    expect(serialized).toContain("R2_APPROVED_PROJECT_REF=fibcbsdattoqiyizzeda");
  });
});
