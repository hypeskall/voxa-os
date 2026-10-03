import "server-only";
export function appOrigin() {
  const configured = process.env.APP_ORIGIN;
  if (!configured && process.env.NODE_ENV === "production") throw new Error("Originea aplicației nu este configurată.");
  const url = new URL(configured ?? "http://localhost:3000");
  if ((process.env.NODE_ENV === "production" && url.protocol !== "https:") || !["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Originea aplicației nu este validă.");
  return url.origin;
}
