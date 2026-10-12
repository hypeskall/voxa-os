import { describe, expect, it, vi } from "vitest";
import { coversBackup, configureBackupRetention, assertBackupRetention } from "../scripts/backup-retention.mjs";
const settings = { account: "a".repeat(32), bucket: "private-backups", token: "test-only" };
const age = (days: number, prefix = "voxa/", enabled = true) => ({ id: "existing", enabled, prefix, condition: { type: "Age", maxAgeSeconds: days * 86400 } });
describe("backup retention holds", () => {
  it("requires a covering enabled rule of at least thirty days", () => {
    expect(coversBackup([age(30)], "voxa/production/archive.voxa")).toBe(true);
    for (const rules of [[], [age(29)], [age(30, "other/")], [age(30, "voxa/", false)]]) expect(coversBackup(rules, "voxa/production/archive.voxa")).toBe(false);
    expect(coversBackup([{ enabled: true, condition: { type: "Indefinite" } }], "voxa/a")).toBe(true);
  });
  it("preserves existing holds and reads back the configured rule", async () => {
    let rules = [age(90, "legal-hold/")];
    const fetcher = vi.fn(async (_url, init) => {
      if (init.method === "PUT") rules = JSON.parse(init.body).rules;
      return Response.json({ success: true, result: { rules } });
    });
    await configureBackupRetention(settings, fetcher);
    expect(rules[0]).toEqual(age(90, "legal-hold/"));
    expect(coversBackup(rules, "voxa/a")).toBe(true);
    await configureBackupRetention(settings, fetcher);
    expect(fetcher.mock.calls.filter(([, init]) => init.method === "PUT")).toHaveLength(1);
  });
  it("fails when permissions or lock readback are unavailable", async () => {
    await expect(assertBackupRetention(settings, "voxa/a", vi.fn().mockResolvedValue(new Response("", { status: 403 })))).rejects.toThrow(/403/);
    await expect(assertBackupRetention(settings, "voxa/a", vi.fn().mockResolvedValue(Response.json({ success: true, result: { rules: [] } })))).rejects.toThrow(/deletion protection/);
  });
});
