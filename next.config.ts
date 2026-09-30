import type { NextConfig } from "next";
function embedAncestors() {
  const configured=(process.env.BOOKING_EMBED_ORIGINS??"").split(",").map(value=>value.trim()).filter(Boolean).flatMap(value=>{try{return [new URL(value).origin];}catch{return [];}});
  return ["'self'",...new Set(configured)].join(" ");
}
function securityHeaders(framePolicy:string,includeFrameHeader=true) {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ...(includeFrameHeader?[{ key: "X-Frame-Options", value: "DENY" }]:[]),
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
    { key: "Content-Security-Policy", value:
      "default-src 'self'; script-src 'self' 'unsafe-inline'" +
      (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "") +
      "; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://*.supabase.co http://127.0.0.1:54321; object-src 'none'; frame-ancestors "+framePolicy+"; base-uri 'self'; form-action 'self'" },
  ];
}
const config: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/", headers: securityHeaders("'none'") },
      {
        source: "/:path((?!embed/booking).*)",
        headers: securityHeaders("'none'"),
      },
      { source: "/embed/booking/:path*", headers: securityHeaders(embedAncestors(),false) },
    ];
  },
};
export default config;
