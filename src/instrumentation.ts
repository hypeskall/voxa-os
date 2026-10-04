import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (error, _request, context) => {
  // Do not serialize messages, stack traces, cookies, URLs, query strings or
  // request bodies: any of them can contain clinical data or bearer tokens.
  const digest = typeof error === "object" && error !== null && "digest" in error && /^\d{1,30}$/.test(String(error.digest))
    ? String(error.digest) : undefined;
  const reference = digest ?? crypto.randomUUID();
  console.error("[voxa:request-error]", { reference, type: context.routeType });
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.ERROR_ALERT_EMAIL) {
    const { alertServerError } = await import("@/lib/email/error-alert");
    await alertServerError(reference, context.routeType);
  }
};
