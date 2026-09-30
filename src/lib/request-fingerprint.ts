import "server-only";
import { createHash } from "node:crypto";

export function requestFingerprint(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip") || "unknown";
  const agent = request.headers.get("user-agent") || "unknown";
  const salt = process.env.BOOKING_RATE_LIMIT_SALT;
  if (!salt && process.env.NODE_ENV === "production") {
    throw new Error("BOOKING_RATE_LIMIT_SALT lipsește din configurația serverului.");
  }
  return createHash("sha256").update(`${salt}|${address}|${agent}`).digest("hex");
}
