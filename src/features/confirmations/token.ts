import "server-only";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

function secret() {
  const value = process.env.CONFIRMATION_TOKEN_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") throw new Error("CONFIRMATION_TOKEN_SECRET lipsește.");
  return "voxa-development-confirmation-secret-change-before-production";
}

export function confirmationToken(publicId: string, expiresAt: string) {
  const expires = Math.floor(new Date(expiresAt).getTime() / 1000);
  const payload = `${publicId}.${expires}`;
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function tokenDigest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createConfirmationMaterial(expiryHours = 168) {
  const publicId = randomUUID();
  const expiresAt = new Date(Date.now() + expiryHours * 3_600_000).toISOString();
  const token = confirmationToken(publicId, expiresAt);
  return { publicId, expiresAt, token, digest: tokenDigest(token) };
}

export function validTokenShape(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3 || !/^[0-9a-f-]{36}$/.test(parts[0]) || !/^\d{10}$/.test(parts[1])) return false;
  const expected = confirmationToken(parts[0], new Date(Number(parts[1]) * 1000).toISOString());
  const left = Buffer.from(token);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right) && Number(parts[1]) * 1000 > Date.now();
}
