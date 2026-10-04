import { describe, expect, it, vi } from "vitest";
// Dependency-free operator scripts are also executed directly by Node in CI.
// @ts-expect-error JavaScript operator module has no declaration file.
import { checkEndpoint, monitorOrigin, runMonitor } from "../scripts/uptime-check.mjs";

const origin = "https://voxa-os.vercel.app";
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
const html = (body: string) => new Response(body, { headers: { "content-type": "text/html" } });

describe("public readiness monitoring", () => {
  it("rejects credentials, query strings, paths and insecure origins", () => {
    for (const value of ["http://example.test", "https://user:password@example.test", "https://example.test/?token=private", "https://example.test/login"])
      expect(() => monitorOrigin(value)).toThrow();
    expect(monitorOrigin()).toBe(origin);
  });

  it("detects an unavailable database even if the response is HTTP 200", async () => {
    const check = { path: "/api/health", kind: "health" };
    expect((await checkEndpoint(origin, check, async () => json({ status: "unavailable" }))).ok).toBe(false);
    expect((await checkEndpoint(origin, check, async () => json({ status: "ok" }))).ok).toBe(true);
    expect((await checkEndpoint(origin, check, async () => new Response('{"status":"ok"}', { headers: { "content-type": "application/json" } }))).ok).toBe(false);
  });

  it("rejects login redirected to a dashboard and error HTML with no form", async () => {
    const check = { path: "/login", kind: "login" };
    expect((await checkEndpoint(origin, check, async () => new Response(null, { status: 307, headers: { location: "/dashboard" } }))).ok).toBe(false);
    expect((await checkEndpoint(origin, check, async () => html("<h1>Application error</h1>"))).ok).toBe(false);
    expect((await checkEndpoint(origin, check, async () => html('<form><input name="identifier"><input name="password"></form>'))).ok).toBe(true);
  });

  it("fails on publicly accessible dashboards and off-site authentication redirects", async () => {
    const check = { path: "/dashboard", kind: "protected" };
    expect((await checkEndpoint(origin, check, async () => html("<h1>Dashboard</h1>"))).ok).toBe(false);
    expect((await checkEndpoint(origin, check, async () => new Response(null, { status: 307, headers: { location: "https://other.test/login" } }))).ok).toBe(false);
    expect((await checkEndpoint(origin, check, async () => new Response(null, { status: 307, headers: { location: "/login?next=%2Fdashboard" } }))).ok).toBe(true);
  });

  it("recognizes a Next.js streamed login redirect but rejects a redirect to another origin", async () => {
    const check = { path: "/dashboard", kind: "protected" };
    expect((await checkEndpoint(origin, check, async () => html('<meta id="__next-page-redirect" http-equiv="refresh" content="1;url=/login"/>'))).ok).toBe(true);
    expect((await checkEndpoint(origin, check, async () => html('<meta id="__next-page-redirect" http-equiv="refresh" content="1;url=https://other.test/login"/>'))).ok).toBe(false);
    expect((await checkEndpoint(origin, check, async () => html('<script>throw Error("NEXT_REDIRECT")</script>'))).ok).toBe(false);
  });

  it("retries transient failures but leaves healthy endpoints alone", async () => {
    let healthAttempts = 0;
    const fetcher = vi.fn(async (url: string, options: RequestInit) => {
      expect(options.redirect).toBe("manual");
      expect(options.headers).not.toHaveProperty("Authorization");
      switch (new URL(url).pathname) {
        case "/api/health": return ++healthAttempts === 1 ? new Response(null, { status: 503 }) : json({ status: "ok" });
        case "/login": return html('<form><input name="identifier"><input name="password"></form>');
        case "/register": return html('<form><input name="email"><input name="password_confirmation"></form>');
        case "/forgot-password": return html('<form><input name="email"></form>');
        case "/dashboard": return new Response(null, { status: 307, headers: { location: "/login" } });
        default: return new Response(null, { status: 404 });
      }
    });
    const pause = vi.fn(async () => {});
    const results = await runMonitor(origin, { fetcher, pause });
    expect(results.every((result: { ok: boolean }) => result.ok)).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(7);
    expect(pause).toHaveBeenCalledOnce();
  });

  it("suppresses sensitive exceptions and malformed or oversized bodies", async () => {
    const check = { path: "/api/health", kind: "health" };
    const result = await checkEndpoint(origin, check, async () => { throw new Error("private-secret token patient body"); });
    expect(JSON.stringify(result)).not.toMatch(/secret|token|patient/);
    expect(result.ok).toBe(false);
    expect((await checkEndpoint(origin, check, async () => new Response("not JSON"))).ok).toBe(false);
    expect((await checkEndpoint(origin, check, async () => new Response("x".repeat(512 * 1024 + 1)))).ok).toBe(false);
  });
});
