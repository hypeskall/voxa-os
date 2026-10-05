import { describe, expect, it } from "vitest";
// @ts-expect-error Operator module is intentionally plain JavaScript.
import { validateLiveTarget } from "../scripts/stripe-live-setup.mjs";
const production={APP_ORIGIN:"https://voxa-os.vercel.app",NEXT_PUBLIC_SUPABASE_URL:"https://fibcbsdattoqiyizzeda.supabase.co"};
describe("live Stripe operator target",()=>{
  it("requires a live server key and the exact existing production project",()=>{
    expect(()=>validateLiveTarget(production,{STRIPE_SECRET_KEY:"rk_live_fixture"})).not.toThrow();
    for(const STRIPE_SECRET_KEY of ["rk_test_fixture","sk_test_fixture","pk_live_fixture",""])
      expect(()=>validateLiveTarget(production,{STRIPE_SECRET_KEY})).toThrow();
    expect(()=>validateLiveTarget({...production,APP_ORIGIN:"https://voxa-os-staging-voxa6.vercel.app"},{STRIPE_SECRET_KEY:"sk_live_fixture"})).toThrow();
    expect(()=>validateLiveTarget({...production,NEXT_PUBLIC_SUPABASE_URL:"https://wlnrfjrjkyywqyvsngps.supabase.co"},{STRIPE_SECRET_KEY:"sk_live_fixture"})).toThrow();
  });
});
