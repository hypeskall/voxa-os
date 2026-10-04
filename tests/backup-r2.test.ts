import { describe, expect, it, vi } from "vitest";
// @ts-expect-error Node operator module has no declarations.
import { snapshotCodec, snapshotHash } from "../scripts/snapshot-codec.mjs";
// @ts-expect-error Node operator module has no declarations.
import { assertPrivateBucket, r2Settings, uploadEncryptedSnapshot } from "../scripts/backup-r2.mjs";

const ref = "wlnrfjrjkyywqyvsngps";
const key = Buffer.alloc(32, 7);
const codec = snapshotCodec(key, ref);
const file = Buffer.from("synthetic private file");
const snapshot = {
  format: 1, ref, createdAt: "2026-10-04T10:00:00.000Z",
  tables: [{ name: "public.patients", rows: [{ id: "synthetic-only" }] }],
  objects: [{ bucket: "private-test", name: "test.txt", content: file.toString("base64"), size: file.length, sha256: snapshotHash(file) }],
};
const env = {
  R2_ACCOUNT_ID: "a".repeat(32), R2_BUCKET: "voxa-private-backups", R2_JURISDICTION: "eu",
  R2_ACCESS_KEY_ID: "b".repeat(32), R2_SECRET_ACCESS_KEY: "c".repeat(64), CLOUDFLARE_API_TOKEN: "d".repeat(40),
};
const settings = r2Settings(env);
const responseJSON = (result: unknown) => new Response(JSON.stringify({ success: true, result }), { headers: { "content-type": "application/json" } });

function storage({ publicDomain = false, corrupt = false, badMetadata = false, oversize = false, conflict = false } = {}) {
  let saved: Buffer | undefined;
  let puts = 0;
  const fetcher = vi.fn(async (input: Request | string, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    if (url.hostname === "api.cloudflare.com") {
      expect(init?.redirect).toBe("error");
      expect(init?.headers).toEqual({ Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, "cf-r2-jurisdiction": "eu" });
      return responseJSON(url.pathname.endsWith("managed") ? { enabled: false } : { domains: [{ enabled: publicDomain }] });
    }
    if (!(input instanceof Request)) throw new Error("Expected signed S3 request.");
    expect(url.hostname).toBe(`${env.R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`);
    expect(input.redirect).toBe("error");
    expect(input.headers.get("authorization")).toMatch(/^AWS4-HMAC-SHA256 /);
    expect(input.headers.get("authorization")).not.toContain(env.CLOUDFLARE_API_TOKEN);
    if (input.method === "PUT") {
      expect(input.headers.get("if-none-match")).toBe("*");
      expect(input.headers.get("x-amz-storage-class")).toBe("STANDARD");
      saved = Buffer.from(await input.arrayBuffer());
      expect(saved.includes(Buffer.from("synthetic-only"))).toBe(false);
      puts++;
      return new Response(null, { status: conflict ? 412 : 200 });
    }
    if (input.method === "HEAD") return saved ? new Response(null, { headers: { "content-length": String(saved.length), "x-amz-meta-sha256": badMetadata ? "wrong" : snapshotHash(saved) } }) : new Response(null, { status: 404 });
    if (!saved) throw new Error("Missing test object.");
    const body = Buffer.from(saved);
    if (corrupt) body[body.length - 1] ^= 1;
    return new Response(new Uint8Array(oversize ? Buffer.concat([body, Buffer.from([0])]) : body));
  });
  return { fetcher, puts: () => puts };
}

describe("encrypted backup custody", () => {
  it("authenticates records/files and uses a fresh nonce for each archive", () => {
    const a = codec.seal(snapshot), b = codec.seal(snapshot);
    expect(a.equals(b)).toBe(false);
    expect(codec.open(a)).toEqual(snapshot);
    expect(() => snapshotCodec(Buffer.alloc(32, 8), ref).open(a)).toThrow();
    expect(() => snapshotCodec(key, "fibcbsdattoqiyizzeda").open(a)).toThrow();
    const corrupt = Buffer.from(a); corrupt[corrupt.length - 1] ^= 1;
    expect(() => codec.open(corrupt)).toThrow();
    expect(() => codec.open(a.subarray(0, 20))).toThrow();
    expect(() => codec.seal({ ...snapshot, objects: [{ ...snapshot.objects[0], sha256: "wrong" }] })).toThrow();
  });

  it("rejects untrusted endpoint inputs and non-EU jurisdictions", () => {
    for (const patch of [{ R2_ACCOUNT_ID: "other.example/token" }, { R2_BUCKET: "../public" }, { R2_JURISDICTION: "default" }, { R2_SECRET_ACCESS_KEY: "missing" }])
      expect(() => r2Settings({ ...env, ...patch })).toThrow();
    expect(settings.endpoint).toBe(`https://${env.R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`);
  });

  it("rejects public domains before any S3 upload", async () => {
    const mock = storage({ publicDomain: true });
    await expect(uploadEncryptedSnapshot(settings, codec.seal(snapshot), codec, { fetcher: mock.fetcher })).rejects.toThrow(/Public/);
    expect(mock.puts()).toBe(0);
    expect(mock.fetcher).toHaveBeenCalledTimes(2);
  });

  it("requires explicit false privacy flags and rejects failed readback", async () => {
    await expect(assertPrivateBucket(settings, async () => responseJSON({ domains: [] }))).rejects.toThrow();
    await expect(assertPrivateBucket(settings, async () => new Response(null, { status: 403 }))).rejects.toThrow();
    await expect(assertPrivateBucket(settings, async (url: string) => responseJSON(url.endsWith("managed") ? { enabled: true } : { domains: [] }))).rejects.toThrow();
  });

  it("uploads only ciphertext and verifies downloaded bytes; repeats do not overwrite", async () => {
    const mock = storage();
    const bytes = codec.seal(snapshot);
    const receipt = await uploadEncryptedSnapshot(settings, bytes, codec, { fetcher: mock.fetcher });
    expect(receipt.verified).toBe(true);
    expect(receipt.sha256).toBe(snapshotHash(bytes));
    expect(receipt.ref).toBe(ref);
    expect(JSON.stringify(receipt)).not.toContain(env.CLOUDFLARE_API_TOKEN);
    expect(JSON.stringify(receipt)).not.toContain(key.toString("hex"));
    await uploadEncryptedSnapshot(settings, bytes, codec, { fetcher: mock.fetcher });
    expect(mock.puts()).toBe(1);
  });

  it("handles a conditional upload race only after verifying the existing object", async () => {
    const mock = storage({ conflict: true });
    expect((await uploadEncryptedSnapshot(settings, codec.seal(snapshot), codec, { fetcher: mock.fetcher })).verified).toBe(true);
  });

  it("does not trust metadata when the actual download is corrupt or too large", async () => {
    for (const options of [{ corrupt: true }, { oversize: true }, { badMetadata: true }]) {
      const mock = storage(options);
      await expect(uploadEncryptedSnapshot(settings, codec.seal(snapshot), codec, { fetcher: mock.fetcher })).rejects.toThrow();
    }
  });

  it("rejects plaintext, wrong keys and foreign snapshots before network access", async () => {
    const fetcher = vi.fn();
    await expect(uploadEncryptedSnapshot(settings, Buffer.from(JSON.stringify(snapshot)), codec, { fetcher })).rejects.toThrow();
    await expect(uploadEncryptedSnapshot(settings, codec.seal(snapshot), snapshotCodec(Buffer.alloc(32, 8), ref), { fetcher })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
