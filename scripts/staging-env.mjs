import fs from "node:fs";

export function readEnv(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}. Copy .env.staging.example and fill staging values.`);
  const result = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) result[match[1]] = match[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return result;
}
export function stagingEnv(file = process.env.STAGING_ENV_FILE || ".env.staging.local") {
  // Deliberately never load .env.local or .env.production.local as credentials.
  const env = readEnv(file);
  const production = fs.existsSync(".env.production.local") ? readEnv(".env.production.local") : {};
  if (env.APP_ENVIRONMENT !== "staging") throw new Error("APP_ENVIRONMENT must be staging.");
  const ref = env.STAGING_SUPABASE_PROJECT_REF;
  if (!/^[a-z]{20}$/.test(ref || "")) throw new Error("STAGING_SUPABASE_PROJECT_REF must be the dedicated staging reference.");
  if (env.NEXT_PUBLIC_SUPABASE_URL !== `https://${ref}.supabase.co`) throw new Error("Staging URL must exactly match the staging reference.");
  if (ref === "fibcbsdattoqiyizzeda" || env.NEXT_PUBLIC_SUPABASE_URL === production.NEXT_PUBLIC_SUPABASE_URL) throw new Error("Refusing the existing production Supabase project.");
  const origin = new URL(env.APP_ORIGIN);
  if (origin.protocol !== "https:" || origin.origin !== env.APP_ORIGIN || origin.username || origin.password || env.APP_ORIGIN === production.APP_ORIGIN || origin.hostname === "voxa-os.vercel.app") throw new Error("APP_ORIGIN must be a separate staging HTTPS origin, without path or trailing slash.");
  const publicKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!publicKey || /replace|placeholder/i.test(publicKey)) throw new Error("A staging publishable/anon key is required.");
  if (publicKey.startsWith("sb_secret_") || publicKey === env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("A server secret cannot be used as a public key.");
  if (publicKey.startsWith("eyJ")) {
    let claims;
    try { claims = JSON.parse(Buffer.from(publicKey.split(".")[1], "base64url").toString()); } catch { throw new Error("Invalid legacy anon key."); }
    if (claims.role !== "anon" || (claims.ref && claims.ref !== ref)) throw new Error("Legacy public key must have anon role and staging reference.");
  } else if (!publicKey.startsWith("sb_publishable_")) throw new Error("Expected a publishable or legacy anon key.");
  if (!env.SUPABASE_SERVICE_ROLE_KEY || /replace|placeholder/i.test(env.SUPABASE_SERVICE_ROLE_KEY)) throw new Error("A staging server service-role/secret key is required.");
  if (env.SUPABASE_SERVICE_ROLE_KEY.startsWith("eyJ")) {
    let claims;
    try { claims = JSON.parse(Buffer.from(env.SUPABASE_SERVICE_ROLE_KEY.split(".")[1], "base64url").toString()); } catch { throw new Error("Invalid service-role key."); }
    if (claims.role !== "service_role" || (claims.ref && claims.ref !== ref)) throw new Error("Service-role key must belong to staging.");
  } else if (!env.SUPABASE_SERVICE_ROLE_KEY.startsWith("sb_secret_")) throw new Error("Expected a server secret or legacy service-role key.");
  if (publicKey === production.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || publicKey === production.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY === production.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Staging keys must differ from production keys.");
  for (const name of ["BOOKING_RATE_LIMIT_SALT", "CONFIRMATION_TOKEN_SECRET", "CRON_SECRET"]) {
    if (!env[name] || env[name].length < 32 || /replace|placeholder/i.test(env[name]) || env[name] === production[name]) throw new Error(`${name} needs a distinct random staging value of at least 32 characters.`);
  }
  if (env.NOTIFICATION_PROVIDER !== "development") throw new Error("Staging acceptance uses development notifications; real sending requires a separately reviewed provider configuration.");
  if (Object.keys(env).some(k => k.startsWith("NEXT_PUBLIC_") && /SECRET|SERVICE|TOKEN|PASSWORD/.test(k))) throw new Error("A secret variable has a public prefix.");
  return { env, ref, origin: origin.origin, publicKey };
}
