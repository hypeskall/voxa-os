import { afterEach, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { deliverStaffInvitation } from "../src/features/organizations/invitation-delivery";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("staff invitation delivery boundary", () => {
  it("marks manual staging delivery accurately without sending a message", async () => {
    vi.stubEnv("STAFF_INVITATION_PROVIDER", "manual");
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect(await deliverStaffInvitation("staff@example.ro", "https://staging.example.ro/invitations/private-token", "invite-id")).toContain("nu a fost trimis automat");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("uses server authentication and an idempotency key for provider acknowledgement", async () => {
    vi.stubEnv("STAFF_INVITATION_PROVIDER", "webhook"); vi.stubEnv("STAFF_INVITATION_PROVIDER_URL", "https://provider.example/invites"); vi.stubEnv("STAFF_INVITATION_PROVIDER_TOKEN", "server-secret");
    const fetch = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal("fetch", fetch);
    expect(await deliverStaffInvitation("staff@example.ro", "https://staging.example.ro/invitations/private-token", "invite-id")).toContain("acceptat");
    expect(fetch.mock.calls[0][1].headers).toMatchObject({ Authorization: "Bearer server-secret", "Idempotency-Key": "invite-id" });
    expect(fetch.mock.calls[0][1].redirect).toBe("error");
  });
  it("does not claim successful sending after timeout or insecure configuration", async () => {
    vi.stubEnv("STAFF_INVITATION_PROVIDER", "webhook"); vi.stubEnv("STAFF_INVITATION_PROVIDER_URL", "https://provider.example/invites"); vi.stubEnv("STAFF_INVITATION_PROVIDER_TOKEN", "server-secret");
    const fetch = vi.fn().mockRejectedValue(new Error("timeout with private token")); vi.stubGlobal("fetch", fetch);
    const result = await deliverStaffInvitation("staff@example.ro", "https://staging.example.ro/invitations/private-token", "invite-id");
    expect(result).toContain("nu a fost confirmată"); expect(result).not.toContain("private-token");
    vi.stubEnv("STAFF_INVITATION_PROVIDER_URL", "http://insecure.example/invites"); fetch.mockClear();
    expect(await deliverStaffInvitation("staff@example.ro", "url", "id")).toContain("nu a fost confirmată"); expect(fetch).not.toHaveBeenCalled();
  });
});
