import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => ({ account: vi.fn(), balance: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("stripe", () => ({ default: class {
  accounts = { retrieve: sdk.account };
  balance = { retrieve: sdk.balance };
} }));
import { stripeConfigured, stripeClient, verifiedStripe } from "../src/features/subscriptions/stripe-client";

beforeEach(() => {
  vi.clearAllMocks();
  for (const [key,value] of Object.entries({APP_ENVIRONMENT:"production",VERCEL_ENV:"production",STRIPE_BILLING_MODE:"live",
    STRIPE_BILLING_ENABLED:"true",STRIPE_SECRET_KEY:"rk_live_fixture",STRIPE_ACCOUNT_ID:"acct_live_fixture",
    STRIPE_PRICE_ID:"price_live_fixture",STRIPE_WEBHOOK_SECRET:"whsec_fixture",STRIPE_PORTAL_CONFIGURATION_ID:"bpc_fixture"})) vi.stubEnv(key,value);
  sdk.account.mockResolvedValue({id:"acct_live_fixture",charges_enabled:true});
  sdk.balance.mockResolvedValue({livemode:true});
});
afterEach(() => vi.unstubAllEnvs());

describe("Stripe deployment and account boundaries", () => {
  it("accepts the explicitly configured live production account",async()=>{
    expect(stripeConfigured()).toBe(true);
    await expect(verifiedStripe()).resolves.toBeDefined();
  });
  it("refuses live keys in staging, preview, local and implicit production configurations",()=>{
    for (const [environment,mode,vercel] of [["staging","live","preview"],["production","live","preview"],["development","live",""],["production","sandbox","production"],["production","","production"]]) {
      vi.stubEnv("APP_ENVIRONMENT",environment);vi.stubEnv("STRIPE_BILLING_MODE",mode);vi.stubEnv("VERCEL_ENV",vercel);
      expect(stripeConfigured()).toBe(false);expect(()=>stripeClient()).toThrow();
    }
  });
  it("rejects a sandbox credential, foreign account and disabled live charge capability",async()=>{
    vi.stubEnv("STRIPE_SECRET_KEY","rk_test_fixture");expect(stripeConfigured()).toBe(false);
    vi.stubEnv("STRIPE_SECRET_KEY","rk_live_fixture");
    sdk.balance.mockResolvedValue({livemode:false});await expect(verifiedStripe()).rejects.toThrow(/mismatch/);
    sdk.balance.mockResolvedValue({livemode:true});sdk.account.mockResolvedValue({id:"acct_other",charges_enabled:true});
    await expect(verifiedStripe()).rejects.toThrow(/mismatch/);
    sdk.account.mockResolvedValue({id:"acct_live_fixture",charges_enabled:false});
    await expect(verifiedStripe()).rejects.toThrow(/cannot accept/);
  });
  it("preserves the sandbox staging configuration and rejects live mode responses there",async()=>{
    vi.stubEnv("APP_ENVIRONMENT","staging");vi.stubEnv("VERCEL_ENV","preview");vi.stubEnv("STRIPE_BILLING_MODE","");
    vi.stubEnv("STRIPE_SECRET_KEY","rk_test_fixture");
    expect(stripeConfigured()).toBe(true);
    await expect(verifiedStripe()).rejects.toThrow(/mismatch/);
    sdk.balance.mockResolvedValue({livemode:false});await expect(verifiedStripe()).resolves.toBeDefined();
    vi.stubEnv("STRIPE_BILLING_ENABLED","false");expect(stripeConfigured()).toBe(false);
  });
});
