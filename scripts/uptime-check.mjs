import path from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

export function monitorOrigin(value = "https://voxa-os.vercel.app") {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.origin !== value || url.username || url.password)
    throw new Error("A public HTTPS origin is required.");
  return url.origin;
}

const checks = [
  { path: "/api/health", kind: "health" },
  { path: "/login", kind: "login" },
  { path: "/register", kind: "register" },
  { path: "/forgot-password", kind: "recovery" },
  { path: "/dashboard", kind: "protected" },
  { path: "/api/staging/status", kind: "hidden" },
];

function input(html, name) {
  return new RegExp(`<input\\b[^>]*\\bname=["']${name}["'][^>]*>`, "i").test(html);
}

function loginTarget(location, origin) {
  if (!location) return false;
  const target = new URL(location, origin);
  return target.origin === origin && target.pathname === "/login";
}

async function boundedBody(response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 512 * 1024) throw new Error("Response exceeds monitor limit.");
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function checkEndpoint(origin, check, fetcher = fetch) {
  let status;
  let response;
  try {
    response = await fetcher(`${origin}${check.path}`, {
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "Voxa-readiness-monitor/1.0", "Cache-Control": "no-cache" },
    });
    status = response.status;
    if (check.kind === "protected") {
      if ([303, 307, 308].includes(status))
        return { path: check.path, status, ok: loginTarget(response.headers.get("location"), origin) };
      // Next.js can start streaming before requireUser resolves. In that case
      // redirect() emits a refresh meta tag instead of an HTTP redirect status.
      if (status === 200 && response.headers.get("content-type")?.includes("text/html")) {
        const body = await boundedBody(response);
        const meta = body.match(/<meta\b[^>]*\bid=["']__next-page-redirect["'][^>]*>/i)?.[0] || "";
        const refresh = /\bhttp-equiv=["']refresh["']/i.test(meta);
        const location = meta.match(/\bcontent=["']\d+;url=([^"']+)["']/i)?.[1];
        return { path: check.path, status, ok: refresh && loginTarget(location, origin) };
      }
      return { path: check.path, status, ok: false };
    }
    if (check.kind === "hidden") return { path: check.path, status, ok: status === 404 };
    if (status !== 200) return { path: check.path, status, ok: false };
    const body = await boundedBody(response);
    let ok = false;
    if (check.kind === "health") {
      ok = response.headers.get("content-type")?.includes("application/json") === true
        && JSON.parse(body).status === "ok"
        && /\bno-store\b/i.test(response.headers.get("cache-control") || "");
    } else if (response.headers.get("content-type")?.includes("text/html")) {
      ok = /<form\b/i.test(body)
        && (check.kind === "login" ? input(body, "identifier") && input(body, "password")
          : check.kind === "register" ? input(body, "email") && input(body, "password_confirmation")
            : input(body, "email"));
    }
    return { path: check.path, status, ok };
  } catch {
    // Never expose response bodies, URLs from exceptions, headers or tokens in public CI logs.
    return { path: check.path, ...(status ? { status } : {}), ok: false };
  } finally {
    if (response?.body && !response.body.locked) await response.body.cancel().catch(() => {});
  }
}

export async function runMonitor(origin, { fetcher = fetch, pause = delay } = {}) {
  const results = await Promise.all(checks.map(check => checkEndpoint(origin, check, fetcher)));
  if (results.some(result => !result.ok)) {
    await pause(10000);
    for (let index = 0; index < results.length; index++) {
      if (!results[index].ok) results[index] = await checkEndpoint(origin, checks[index], fetcher);
    }
  }
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const results = await runMonitor(monitorOrigin(process.env.VOXA_APP_ORIGIN));
    for (const result of results)
      console.log(`${result.ok ? "PASS" : "FAIL"} ${result.path}: ${result.status ?? "network/timeout"}`);
    if (results.some(result => !result.ok)) process.exitCode = 1;
  } catch {
    console.error("Monitor configuration failed; diagnostics suppressed.");
    process.exitCode = 1;
  }
}
