// Internal CLI only. Never import into the web app or expose through an API.
import { randomBytes, createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { assertDeploymentTarget } from "../src/lib/deployment-target.ts";

const [command, ...args] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
assertDeploymentTarget(
  process.env.APP_ENVIRONMENT,
  process.env.STAGING_SUPABASE_PROJECT_REF,
  url,
  process.env.APP_ORIGIN,
);
if (!url || !key)
  throw new Error(
    "Set server-only Supabase URL and service-role credentials in the operator environment.",
  );
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
if (command === "issue") {
  const organization = option("--organization");
  const months = Number(option("--months") ?? 1);
  if (
    (organization && !uuid.test(organization)) ||
    !Number.isInteger(months) ||
    months < 1 ||
    months > 12
  )
    throw new Error("Invalid organization UUID or months (1–12).");
  const code = `VOXA-${randomBytes(16).toString("hex").toUpperCase().match(/.{4}/g).join("-")}`;
  const { data, error } = await client.rpc("issue_license", {
    digest: createHash("sha256").update(code).digest("hex"),
    hint: code.slice(-4),
    assigned_org: organization ?? null,
    months,
    redeem_deadline: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  });
  if (error) throw new Error(`License issue failed (${error.code}).`);
  process.stdout.write(
    `License ID: ${data}\nCode (shown once): ${code}\nStore securely and send only to the authorized owner. Redemption deadline: 30 days.\n`,
  );
} else if (command === "revoke") {
  if (!uuid.test(args[0] ?? "")) throw new Error("Provide the license UUID.");
  const { error } = await client.rpc("revoke_license", { lid: args[0] });
  if (error) throw new Error(`Revocation failed (${error.code}).`);
  process.stdout.write(
    "License revoked. Access is re-evaluated immediately.\n",
  );
} else if (command === "expire") {
  const { data, error } = await client.rpc("expire_subscriptions");
  if (error) throw new Error(`Expiry sweep failed (${error.code}).`);
  process.stdout.write(`Updated ${data} subscriptions.\n`);
} else {
  throw new Error(
    "Usage: node --env-file=.env.local scripts/licenses.mjs issue [--organization UUID] [--months 1] | revoke UUID | expire",
  );
}
