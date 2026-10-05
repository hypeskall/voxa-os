import { beforeAll, afterAll, describe, it, expect } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import Stripe from "stripe";
import { migratedDatabase, callerQuery, ids } from "./support/database";
import { STRIPE_API_VERSION, assertMonthlyPrice, subscriptionSnapshot } from "../src/features/subscriptions/stripe-model";
let db: PGlite;
const service = (sql: string, args: unknown[] = []) => db.transaction(async tx => {
  await tx.exec("set local role service_role; select set_config('request.jwt.claim.role','service_role',true); select set_config('request.jwt.claims','{\"role\":\"service_role\"}',true)");
  return tx.query<{ result: unknown }>(sql,args);
});
const lock = async () => (await service("select public.stripe_billing_lock($1) result",[ids.org])).rows[0].result as {lease_token:string};
const save = (token:string, payload:unknown) => service("select public.stripe_billing_save($1,$2,$3::jsonb)",[ids.org,token,JSON.stringify(payload)]);
const snap = (overrides = {}) => ({customer_id:"cus_test",subscription_id:"sub_test",stripe_status:"active",paid:true,
  period_start:new Date(Date.now()-10000).toISOString(),period_end:new Date(Date.now()+86400000).toISOString(),cancel_at_period_end:false,...overrides});
const apply = (token:string, event:string, snapshot:unknown) => service("select public.stripe_billing_apply($1,$2,$3,'invoice.paid',$4::jsonb) result",[ids.org,token,event,JSON.stringify(snapshot)]);
beforeAll(async()=>{db=await migratedDatabase();});
afterAll(async()=>{await db.close();});
describe("Stripe billing database trust boundary",()=>{
  it("restricts leases and mutations to server, summary to OWNER with MFA",async()=>{
    for(const uid of [ids.owner,ids.admin,ids.outsider]) await expect(callerQuery(db,uid,"select public.stripe_billing_lock($1)",[ids.org])).rejects.toThrow();
    const b=await lock(); await save(b.lease_token,{customer_id:"cus_test"});
    await expect(lock()).rejects.toThrow("Billing busy");
    const fields="organization_id,customer_id,subscription_id,status,updated_at";
    expect((await callerQuery(db,ids.owner,`select ${fields} from public.organization_stripe_billing`)).rows).toHaveLength(1);
    for(const uid of [ids.admin,ids.reception,ids.outsider]) expect((await callerQuery(db,uid,`select ${fields} from public.organization_stripe_billing`)).rows).toHaveLength(0);
    await expect(callerQuery(db,ids.owner,"select lease_token from public.organization_stripe_billing")).rejects.toThrow();
    await db.query("insert into auth.mfa_factors(user_id,status) values($1,'verified')",[ids.owner]);
    expect((await callerQuery(db,ids.owner,`select ${fields} from public.organization_stripe_billing`)).rows).toHaveLength(0);
    await db.query("delete from auth.mfa_factors where user_id=$1",[ids.owner]);
    await save(b.lease_token,{release:true});
  });
  it("atomically deduplicates events, enforces customer mapping and preserves trial dates",async()=>{
    const original=(await db.query("select trial_ends_at from public.organization_subscriptions where organization_id=$1",[ids.org])).rows[0];
    const b=await lock(); const snapshot=snap();
    await expect(apply(b.lease_token,"evt_wrong",snap({customer_id:"cus_other"}))).rejects.toThrow("Customer mismatch");
    expect((await apply(b.lease_token,"evt_paid",snapshot)).rows[0].result).toBe(true);
    expect((await apply(b.lease_token,"evt_paid",snap({paid:false}))).rows[0].result).toBe(false);
    expect((await db.query<{status:string}>("select status from public.organization_subscriptions where organization_id=$1",[ids.org])).rows[0].status).toBe("active");
    expect((await db.query("select trial_ends_at from public.organization_subscriptions where organization_id=$1",[ids.org])).rows[0]).toEqual(original);
    expect((await db.query("select * from private.stripe_processed_events where event_id='evt_wrong'")).rows).toHaveLength(0);
    await save(b.lease_token,{release:true});
    await expect(apply(b.lease_token,"evt_stale",snapshot)).rejects.toThrow("Billing lease expired");
  });
  it("suspends unpaid access without extending trials, bounds cancellation and can recover paid access",async()=>{
    await db.query("update public.organization_subscriptions set trial_started_at=now()-interval '31 days',trial_ends_at=now()-interval '1 day' where organization_id=$1",[ids.org]);
    const b=await lock();
    await apply(b.lease_token,"evt_failed",snap({stripe_status:"past_due",paid:false}));
    expect((await callerQuery<{allowed:boolean}>(db,ids.owner,"select public.organization_access($1) allowed",[ids.org])).rows[0].allowed).toBe(false);
    await apply(b.lease_token,"evt_recovered",snap({cancel_at_period_end:true}));
    expect((await callerQuery<{allowed:boolean}>(db,ids.owner,"select public.organization_access($1) allowed",[ids.org])).rows[0].allowed).toBe(true);
    await apply(b.lease_token,"evt_canceled",snap({stripe_status:"canceled",paid:false}));
    expect((await callerQuery<{allowed:boolean}>(db,ids.owner,"select public.organization_access($1) allowed",[ids.org])).rows[0].allowed).toBe(false);
    await save(b.lease_token,{release:true});
  });
  it("rolls back malformed entitlement/event, and preserves manual licenses",async()=>{
    const b=await lock();
    await expect(apply(b.lease_token,"evt_bad_period",snap({period_end:null}))).rejects.toThrow("Invalid paid period");
    expect((await db.query("select * from private.stripe_processed_events where event_id='evt_bad_period'")).rows).toHaveLength(0);
    await save(b.lease_token,{release:true});
    const license=(await service("select public.issue_license($1,'ABCD',$2) result",["a".repeat(64),ids.org])).rows[0].result;
    await callerQuery(db,ids.owner,"select public.activate_license($1,$2)",[ids.org,"a".repeat(64)]);
    const next=await lock(); await apply(next.lease_token,"evt_after_license",snap({stripe_status:"canceled",paid:false}));
    expect((await db.query("select entitlement_source,license_key_id from public.organization_subscriptions where organization_id=$1",[ids.org])).rows[0]).toEqual({entitlement_source:"license",license_key_id:license});
    await save(next.lease_token,{release:true});
  });
  it("persists annual paid access and rejects unsupported billing cycles", async () => {
    await db.query("update public.organization_subscriptions set status='inactive',entitlement_source=null,license_key_id=null,current_period_start=null,current_period_end=null where organization_id=$1", [ids.org]);
    const b = await lock();
    await expect(apply(b.lease_token, "evt_invalid_cycle", snap({ billing_cycle: "weekly" }))).rejects.toThrow("Invalid billing cycle");
    await apply(b.lease_token, "evt_annual", snap({ billing_cycle: "annual" }));
    expect((await db.query("select plan,billing_cycle,status from public.organization_subscriptions where organization_id=$1", [ids.org])).rows[0]).toEqual({ plan: "voxa_os_annual", billing_cycle: "annual", status: "active" });
    await save(b.lease_token, { release: true });
  });
});
function fixture() {
  return {id:"sub_test",livemode:false,status:"active",metadata:{app:"voxa-os",organization_id:ids.org},customer:"cus_test",cancel_at:null,cancel_at_period_end:false,pause_collection:null,
    items:{data:[{id:"si_test",quantity:1,current_period_start:100,current_period_end:200,price:{id:"price_test",active:true,livemode:false,currency:"eur",unit_amount:1999,recurring:{interval:"month",interval_count:1,usage_type:"licensed"}}}]},
    latest_invoice:{id:"in_test",status:"paid",livemode:false,customer:"cus_test",currency:"eur",amount_paid:1999,amount_remaining:0,parent:{subscription_details:{subscription:"sub_test"}},
      lines:{data:[{amount:1999,quantity:1,period:{start:100,end:200},pricing:{price_details:{price:"price_test"}},parent:{subscription_item_details:{subscription_item:"si_test",proration:false}}}]}}
  } as unknown as Stripe.Subscription;
}
it("grants annual access only for the configured EUR 149.99 yearly price and paid invoice", () => {
  const subscription = fixture();
  const price = subscription.items.data[0].price;
  price.id = "price_annual"; price.unit_amount = 14999; price.recurring!.interval = "year";
  const invoice = subscription.latest_invoice as Stripe.Invoice;
  invoice.amount_paid = 14999; invoice.lines.data[0].amount = 14999;
  invoice.lines.data[0].pricing!.price_details!.price = "price_annual";
  const prices = { monthly: "price_test", annual: "price_annual" };
  expect(subscriptionSnapshot(subscription, prices, ids.org)).toMatchObject({ paid: true, billing_cycle: "annual" });
  expect(() => subscriptionSnapshot(subscription, "price_test", ids.org)).toThrow();
  invoice.amount_paid = 1999;
  expect(subscriptionSnapshot(subscription, prices, ids.org).paid).toBe(false);
  invoice.amount_paid = 14999; price.recurring!.interval = "month";
  expect(() => subscriptionSnapshot(subscription, prices, ids.org)).toThrow();
});
it("requires the configured price, organization, quantity and paid matching period",()=>{
  const s=fixture(); expect(subscriptionSnapshot(s,"price_test",ids.org).paid).toBe(true);
  expect(()=>subscriptionSnapshot(s,"price_other",ids.org)).toThrow();
  expect(()=>subscriptionSnapshot(s,"price_test",ids.otherOrg)).toThrow();
  const invoice=s.latest_invoice as Stripe.Invoice; invoice.amount_paid=0;
  expect(subscriptionSnapshot(s,"price_test",ids.org).paid).toBe(false);
  invoice.amount_paid=1999; invoice.lines.data[0].period.end=150;
  expect(subscriptionSnapshot(s,"price_test",ids.org).paid).toBe(false);
  const live=fixture(); live.livemode=true; expect(()=>subscriptionSnapshot(live,"price_test",ids.org)).toThrow();
  expect(()=>assertMonthlyPrice({...fixture().items.data[0].price,unit_amount:2999})).toThrow();
});
it("caps scheduled cancellation and verifies webhook signatures and timestamps",()=>{
  const s=fixture(); s.cancel_at=180; const snapshot=subscriptionSnapshot(s,"price_test",ids.org);
  expect(snapshot.period_end).toBe(new Date(180000).toISOString()); expect(snapshot.cancel_at_period_end).toBe(true);
  const stripe=new Stripe("sk_test_fixture",{apiVersion:STRIPE_API_VERSION}); const secret="whsec_fixture";
  const payload=JSON.stringify({id:"evt_test",object:"event",livemode:false,type:"invoice.paid",data:{object:{id:"in_test"}}});
  const signature=stripe.webhooks.generateTestHeaderString({payload,secret});
  expect(stripe.webhooks.constructEvent(payload,signature,secret).id).toBe("evt_test");
  expect(()=>stripe.webhooks.constructEvent(payload+" ",signature,secret)).toThrow();
  expect(()=>stripe.webhooks.constructEvent(payload,stripe.webhooks.generateTestHeaderString({payload,secret,timestamp:1}),secret)).toThrow();
});
it("accepts live paid subscriptions only when every billing object belongs to live mode",()=>{
  const s=fixture();s.livemode=true;s.items.data[0].price.livemode=true;
  const invoice=s.latest_invoice as Stripe.Invoice;invoice.livemode=true;
  expect(subscriptionSnapshot(s,"price_test",ids.org,true).paid).toBe(true);
  expect(()=>subscriptionSnapshot(s,"price_test",ids.org)).toThrow();
  invoice.livemode=false;expect(subscriptionSnapshot(s,"price_test",ids.org,true).paid).toBe(false);
  invoice.livemode=true;s.items.data[0].price.livemode=false;
  expect(()=>subscriptionSnapshot(s,"price_test",ids.org,true)).toThrow();
  s.livemode=false;expect(()=>subscriptionSnapshot(s,"price_test",ids.org,true)).toThrow();
});
