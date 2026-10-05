import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Stripe from "stripe";
const billing=vi.hoisted(()=>({lookup:vi.fn(),reconcile:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/supabase/admin",()=>({adminDb:()=>({from:()=>({select:()=>({eq:()=>({maybeSingle:billing.lookup})})})})}));
vi.mock("@/features/subscriptions/stripe-service",()=>({billingLock:vi.fn(),billingSave:vi.fn(),reconcileBilling:billing.reconcile}));
import { POST } from "../src/app/api/stripe/webhook/route";
const signingSecret="whsec_fixture";
const sdk=new Stripe("sk_test_fixture");
beforeEach(()=>{
  vi.clearAllMocks();billing.lookup.mockResolvedValue({data:null,error:null});
  for(const [key,value] of Object.entries({APP_ENVIRONMENT:"production",VERCEL_ENV:"production",STRIPE_BILLING_MODE:"live",STRIPE_BILLING_ENABLED:"true",
    STRIPE_SECRET_KEY:"rk_live_fixture",STRIPE_PRICE_ID:"price_fixture",STRIPE_ACCOUNT_ID:"acct_fixture",STRIPE_PORTAL_CONFIGURATION_ID:"bpc_fixture",STRIPE_WEBHOOK_SECRET:signingSecret}))vi.stubEnv(key,value);
});
afterEach(()=>vi.unstubAllEnvs());
function signed(livemode:boolean,account?:string){
  const payload=JSON.stringify({id:"evt_fixture",object:"event",livemode,...(account?{account}:{}),type:"invoice.paid",data:{object:{id:"in_fixture",customer:"cus_unmapped"}}});
  return new Request("https://voxa-os.vercel.app/api/stripe/webhook",{method:"POST",body:payload,
    headers:{"stripe-signature":sdk.webhooks.generateTestHeaderString({payload,secret:signingSecret})}});
}
it("rejects correctly signed sandbox and connected-account events on live without touching billing",async()=>{
  expect((await POST(signed(false))).status).toBe(400);
  expect((await POST(signed(true,"acct_foreign"))).status).toBe(400);
  expect(billing.lookup).not.toHaveBeenCalled();expect(billing.reconcile).not.toHaveBeenCalled();
});
it("accepts a live event for an unmapped customer without granting any organization access",async()=>{
  expect((await POST(signed(true))).status).toBe(200);
  expect(billing.lookup).toHaveBeenCalledOnce();expect(billing.reconcile).not.toHaveBeenCalled();
});
it("continues to reject signed live events on the staging sandbox",async()=>{
  vi.stubEnv("APP_ENVIRONMENT","staging");vi.stubEnv("VERCEL_ENV","preview");vi.stubEnv("STRIPE_BILLING_MODE","sandbox");vi.stubEnv("STRIPE_SECRET_KEY","rk_test_fixture");
  expect((await POST(signed(true))).status).toBe(400);expect(billing.lookup).not.toHaveBeenCalled();
});
