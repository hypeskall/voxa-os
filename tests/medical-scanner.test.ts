import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
vi.mock("server-only", () => ({}));
import { scanMedicalBytes } from "../src/lib/medical-malware-scan";
const secret = "synthetic-scanner-secret-only-".repeat(2);
beforeEach(() => { vi.stubEnv("MEDICAL_SCANNER_URL", "https://scanner.example.test/scan"); vi.stubEnv("MEDICAL_SCANNER_SECRET", secret); });
afterEach(() => vi.unstubAllEnvs());
function scanner(patch: Record<string, unknown> = {}, signSecret = secret) {
  return vi.fn(async (_input: unknown, init?: RequestInit) => {
    expect(init?.redirect).toBe("error"); expect(init?.cache).toBe("no-store");
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe(`Bearer ${secret}`);
    expect(headers.has("x-voxa-patient-keyring")).toBe(false);
    const nonce = headers.get("x-scan-nonce"), sha256 = headers.get("x-content-sha256");
    const verdict = { status: "clean", nonce, sha256, definitionsUpdatedAt: new Date().toISOString(), ...patch };
    const signature = createHmac("sha256", signSecret).update(`voxa:scan:v1:${verdict.nonce}:${verdict.sha256}:${verdict.status}:${verdict.definitionsUpdatedAt}`).digest("hex");
    return Response.json({ ...verdict, signature });
  }) as unknown as typeof fetch;
}
describe("private authenticated malware verification", () => {
  it("accepts only a fresh signed verdict bound to the exact bytes and request", async () => {
    expect(await scanMedicalBytes(new Uint8Array([1, 2, 3]), scanner())).toHaveProperty("sha256");
    for (const patch of [{ nonce: "00000000-0000-4000-8000-000000000001" }, { sha256: "a".repeat(64) }, { definitionsUpdatedAt: new Date(Date.now() - 49 * 3600000).toISOString() }, { status: "unknown" }])
      await expect(scanMedicalBytes(new Uint8Array([1]), scanner(patch))).rejects.toThrow(/antivirus/);
    await expect(scanMedicalBytes(new Uint8Array([1]), scanner({}, "wrong-key"))).rejects.toThrow(/antivirus/);
  });
  it("blocks infected files and all scanner failures", async () => {
    await expect(scanMedicalBytes(new Uint8Array([1]), scanner({ status: "infected" }))).rejects.toThrow(/blocat/);
    await expect(scanMedicalBytes(new Uint8Array([1]), scanner({ status: "unavailable" }))).rejects.toThrow(/nu este disponibilă/);
    await expect(scanMedicalBytes(new Uint8Array([1]), vi.fn().mockRejectedValue(new Error("private-provider-diagnostic")))).rejects.toThrow(/nu este disponibilă/);
    await expect(scanMedicalBytes(new Uint8Array([1]), vi.fn().mockResolvedValue(new Response("x".repeat(3000))))).rejects.toThrow(/antivirus/);
  });
  it("refuses plaintext transport, URL credentials and absent configuration before transmission", async () => {
    for (const url of ["http://scanner.example.test/scan", "https://secret:password@scanner.example.test/scan", "https://scanner.example.test/scan?secret=token", ""]) {
      vi.stubEnv("MEDICAL_SCANNER_URL", url); const fetcher = vi.fn();
      await expect(scanMedicalBytes(new Uint8Array([1]), fetcher)).rejects.toThrow(/antivirus/);
      expect(fetcher).not.toHaveBeenCalled();
    }
  });
});
