import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";
vi.mock("server-only", () => ({}));
import { cleanupUploads } from "../src/lib/storage-cleanup";
function client(remove: ReturnType<typeof vi.fn>, rpc = vi.fn().mockResolvedValue({ data: "job-id", error: null })) {
  return { value: { storage: { from: () => ({ remove }) }, rpc } as unknown as SupabaseClient<Database>, rpc };
}
describe("private upload compensation failures", () => {
  it("does not enqueue successful compensation", async () => {
    const c = client(vi.fn().mockResolvedValue({ data: [{ name: "file" }], error: null }));
    expect(await cleanupUploads(c.value, "voxa-medical", ["file"])).toBe("");
    expect(c.rpc).not.toHaveBeenCalled();
  });
  it("queues each path after partial deletion or a denied deletion", async () => {
    const c = client(vi.fn().mockResolvedValue({ data: [], error: null }));
    expect(await cleanupUploads(c.value, "voxa-medical", ["one", "two"])).toContain("înregistrată");
    expect(c.rpc).toHaveBeenCalledTimes(2);
    expect(c.rpc).toHaveBeenCalledWith("queue_storage_cleanup", { bucket: "voxa-medical", path: "one" });
  });
  it("also records network failure without returning sensitive object names", async () => {
    const c = client(vi.fn().mockRejectedValue(new Error("network")));
    const result = await cleanupUploads(c.value, "voxa-branding", ["sensitive-path"]);
    expect(result).toContain("înregistrată");
    expect(result).not.toContain("sensitive-path");
  });
  it("explicitly reports failure when durable recording is unavailable", async () => {
    const c = client(vi.fn().mockRejectedValue(new Error("network")), vi.fn().mockResolvedValue({ error: { code: "42501" } }));
    expect(await cleanupUploads(c.value, "voxa-medical", ["file"])).toContain("necesită verificarea");
  });
});
