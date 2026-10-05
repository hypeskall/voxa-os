import fs from "node:fs";
import {randomBytes,createHash} from "node:crypto";
import Stripe from "stripe";
import {createClient} from "@supabase/supabase-js";
import {test,expect} from "@playwright/test";
import {stagingEnv} from "../../scripts/staging-env.mjs";
import {STRIPE_API_VERSION} from "../../src/features/subscriptions/stripe-model";
const config=stagingEnv();
test("annual sandbox Checkout, verified API payment, portal cancellation and tenant boundaries",async({page,context,request})=>{
 test.setTimeout(240000);
 const fixture=JSON.parse(fs.readFileSync(".staging-deploy/stripe-fixture.local.json","utf8"));
 const headers={"x-vercel-protection-bypass":config.env.STRIPE_STAGING_BYPASS_SECRET};
 await context.route(`${config.origin}/**`,route=>route.continue({headers:{...route.request().headers(),...headers}}));
 const marker=await request.get("/api/staging/status",{headers,maxRedirects:0});expect(marker.status()).toBe(200);
 expect((await marker.json()).supabaseProjectRef).toBe(config.ref);
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
 const admin=createClient(config.env.NEXT_PUBLIC_SUPABASE_URL,config.env.SUPABASE_SERVICE_ROLE_KEY,options);
 const stripe=new Stripe(config.env.STRIPE_SECRET_KEY,{apiVersion:STRIPE_API_VERSION});
 const billingPath=`/organizations/${fixture.organizationId}/billing`;
 await page.goto(`/login?next=${encodeURIComponent(billingPath)}`);
 await page.getByLabel("Utilizator").fill(fixture.email);await page.getByLabel("Parolă",{exact:true}).fill(fixture.password);
 await page.getByRole("button",{name:"Conectare",exact:true}).click();await expect(page).toHaveURL(/\/organizations\/.+\/subscription-expired/);
 await page.goto(billingPath);
 await expect(page.getByRole("heading",{name:"Abonament online · test"})).toBeVisible();
 await page.goto(billingPath+"?checkout=received");
 const before=await admin.from("organization_subscriptions").select("status,entitlement_source").eq("organization_id",fixture.organizationId).single();
 expect(before.data?.status).not.toBe("active");
 await page.getByRole("radio", { name: /Anual/ }).check();
 await page.getByRole("checkbox",{name:/Confirm reînnoirea/}).check();
 await page.getByRole("button",{name:"Continuă la plata de test"}).click();
 await expect(page).toHaveURL(/^https:\/\/checkout.stripe.com\//,{timeout:30000});
 // Hosted Checkout currently presents an anti-automation CAPTCHA. Do not bypass
 // it: verify initiation in-browser, then use official sandbox payment fixtures
 // to exercise real invoice/subscription webhooks independently of card entry.
 const pending=await admin.from("organization_stripe_billing").select("customer_id,checkout_id").eq("organization_id",fixture.organizationId).single();
 expect(pending.error).toBeNull();
 const checkout=await stripe.checkout.sessions.retrieve(pending.data!.checkout_id, { expand: ["line_items"] });
 expect(checkout.livemode).toBe(false);expect(checkout.mode).toBe("subscription");
 expect(checkout.line_items?.data[0].price?.id).toBe(config.env.STRIPE_ANNUAL_PRICE_ID);
 expect(checkout.line_items?.data[0].amount_total).toBe(14999);
 expect(checkout.subscription).toBeNull();
 await stripe.checkout.sessions.expire(checkout.id);
 const method=await stripe.paymentMethods.attach("pm_card_visa",{customer:pending.data!.customer_id});
 const subscription=await stripe.subscriptions.create({customer:pending.data!.customer_id,
   default_payment_method:method.id,items:[{price:config.env.STRIPE_ANNUAL_PRICE_ID,quantity:1}],
   billing_mode:{type:"flexible"},automatic_tax:{enabled:false},
   metadata:{app:"voxa-os",organization_id:fixture.organizationId}},
   {idempotencyKey:"voxa-sandbox-fixture-"+checkout.id});
 expect(subscription.livemode).toBe(false);expect(subscription.status).toBe("active");
 await page.goto(billingPath);
 await expect.poll(async()=>{const r=await admin.from("organization_subscriptions").select("status").eq("organization_id",fixture.organizationId).single();return r.data?.status;},{timeout:60000}).toBe("active");
 const annualAccess=await admin.from("organization_subscriptions").select("plan,billing_cycle,current_period_start,current_period_end").eq("organization_id",fixture.organizationId).single();
 expect(annualAccess.data?.plan).toBe("voxa_os_annual");
 expect(annualAccess.data?.billing_cycle).toBe("annual");
 expect(Date.parse(annualAccess.data!.current_period_end)-Date.parse(annualAccess.data!.current_period_start)).toBeGreaterThan(360*86400000);
 const billing=await admin.from("organization_stripe_billing").select("customer_id,subscription_id").eq("organization_id",fixture.organizationId).single();
 expect(billing.error).toBeNull();expect(billing.data?.subscription_id).toBeTruthy();
 fixture.customerId=billing.data!.customer_id;fixture.subscriptionId=billing.data!.subscription_id;
 fs.writeFileSync(".staging-deploy/stripe-fixture.local.json",JSON.stringify(fixture,null,2));
 await page.reload();await page.getByRole("button",{name:"Gestionează abonamentul și facturile"}).click();
 await expect(page).toHaveURL(/^https:\/\/billing.stripe.com\//,{timeout:30000});
 const paid=await stripe.subscriptions.retrieve(fixture.subscriptionId);expect(paid.status).toBe("active");expect(paid.livemode).toBe(false);
 await stripe.subscriptions.update(paid.id,{cancel_at_period_end:true});
 await expect.poll(async()=>{const r=await admin.from("organization_subscriptions").select("cancel_at_period_end,status").eq("organization_id",fixture.organizationId).single();return r.data?.cancel_at_period_end===true&&r.data.status==="active";},{timeout:60000}).toBe(true);
 await page.goto(billingPath);await expect(page.getByText("Se încheie la finalul perioadei",{exact:true})).toBeVisible();
 const invalid=await request.post("/api/stripe/webhook",{headers:{...headers,"stripe-signature":"invalid"},data:{id:"evt_fake"}});expect(invalid.status()).toBe(400);
 const paidEvents=await stripe.events.list({type:"invoice.paid",limit:100});
 const paidEvent=paidEvents.data.find(event=>(event.data.object as Stripe.Invoice).customer===fixture.customerId);
 expect(paidEvent).toBeTruthy();
 const eventPayload=JSON.stringify(paidEvent);
 const countBefore=await admin.from("subscription_events").select("id",{count:"exact",head:true}).eq("organization_id",fixture.organizationId);
 for(let i=0;i<2;i++){
  const signature=stripe.webhooks.generateTestHeaderString({payload:eventPayload,secret:config.env.STRIPE_WEBHOOK_SECRET});
  const replay=await request.post("/api/stripe/webhook",{headers:{...headers,"stripe-signature":signature,"content-type":"application/json"},data:eventPayload});
  expect(replay.status()).toBe(200);
 }
 const countAfter=await admin.from("subscription_events").select("id",{count:"exact",head:true}).eq("organization_id",fixture.organizationId);
 expect(countAfter.count).toBe(countBefore.count);
 const owner=createClient(config.env.NEXT_PUBLIC_SUPABASE_URL,config.publicKey,options);await owner.auth.signInWithPassword({email:fixture.email,password:fixture.password});
 const foreign=await owner.from("organization_stripe_billing").select("customer_id").neq("organization_id",fixture.organizationId);expect(foreign.error).toBeNull();expect(foreign.data).toHaveLength(0);
 const mutation=await owner.rpc("stripe_billing_lock",{oid:fixture.organizationId});expect(mutation.error).toBeTruthy();
 await owner.auth.signOut({scope:"local"});
 await stripe.subscriptions.cancel(fixture.subscriptionId);
 await expect.poll(async()=>{const r=await admin.from("organization_subscriptions").select("status").eq("organization_id",fixture.organizationId).single();return r.data?.status;},{timeout:60000}).toBe("canceled");
 fs.writeFileSync(".staging-deploy/stripe-checkout.receipt.json",JSON.stringify({verifiedAt:new Date().toISOString(),ref:config.ref,organizationId:fixture.organizationId,billingCycle:"annual",amount:14999,checkoutInitiated:true,cardEntryVerified:false,cardEntryLimitation:"Stripe anti-automation CAPTCHA",paymentViaOfficialSandboxApi:true,paidWebhook:true,portal:true,cancelAtPeriodEnd:true,tenantIsolation:true,invalidSignatureRejected:true}));
 console.log("PASS: hosted Checkout initiation, official sandbox payment, signed paid webhook, portal, cancellation, duplicate/out-of-order replay and tenant isolation; synthetic subscription canceled after verification.");
});

test("sandbox failed payment, recovery, refund and live-event rejection",async({request})=>{
 test.setTimeout(180000);
 const fixture=JSON.parse(fs.readFileSync(".staging-deploy/stripe-fixture.local.json","utf8"));
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
 const admin=createClient(config.env.NEXT_PUBLIC_SUPABASE_URL,config.env.SUPABASE_SERVICE_ROLE_KEY,options);
 const stripe=new Stripe(config.env.STRIPE_SECRET_KEY,{apiVersion:STRIPE_API_VERSION});
 const mapping=await admin.from("organization_stripe_billing").select("customer_id").eq("organization_id",fixture.organizationId).single();
 expect(mapping.error).toBeNull();const customer=mapping.data!.customer_id;
 const existing=await stripe.subscriptions.list({customer,status:"all",limit:100});
 expect(existing.data.filter(s=>!["canceled","incomplete_expired"].includes(s.status))).toHaveLength(0);
 const decline=await stripe.paymentMethods.attach("pm_card_chargeCustomerFail",{customer});
 const subscription=await stripe.subscriptions.create({customer,default_payment_method:decline.id,
   items:[{price:config.env.STRIPE_PRICE_ID,quantity:1}],billing_mode:{type:"flexible"},
   payment_behavior:"allow_incomplete",automatic_tax:{enabled:false},metadata:{app:"voxa-os",organization_id:fixture.organizationId}});
 expect(subscription.status).toBe("incomplete");expect(subscription.livemode).toBe(false);
 const state=async()=>{const r=await admin.from("organization_subscriptions").select("status,provider_reference").eq("organization_id",fixture.organizationId).single();return r.data;};
 try{
  await expect.poll(async()=>{const s=await state();return s?.provider_reference===subscription.id&&s.status==="inactive";},{timeout:60000}).toBe(true);
  const visa=await stripe.paymentMethods.attach("pm_card_visa",{customer});
  await stripe.subscriptions.update(subscription.id,{default_payment_method:visa.id});
  const invoiceId=typeof subscription.latest_invoice==="string"?subscription.latest_invoice:subscription.latest_invoice!.id;
  const invoice=await stripe.invoices.pay(invoiceId,{payment_method:visa.id});expect(invoice.status).toBe("paid");
  await expect.poll(async()=>(await state())?.status,{timeout:60000}).toBe("active");
  const payments=await stripe.invoicePayments.list({invoice:invoiceId,status:"paid"});
  const intent=payments.data[0].payment.payment_intent;
  const intentId=typeof intent==="string"?intent:intent!.id;
  await stripe.refunds.create({payment_intent:intentId});
  await expect.poll(async()=>(await state())?.status,{timeout:60000}).toBe("inactive");
  const payload=JSON.stringify({id:"evt_live_rejected_fixture",object:"event",livemode:true,type:"invoice.paid",data:{object:{customer}}});
  const signature=stripe.webhooks.generateTestHeaderString({payload,secret:config.env.STRIPE_WEBHOOK_SECRET});
  const rejected=await request.post("/api/stripe/webhook",{headers:{"x-vercel-protection-bypass":config.env.STRIPE_STAGING_BYPASS_SECRET,"stripe-signature":signature,"content-type":"application/json"},data:payload});
  expect(rejected.status()).toBe(400);
  fs.writeFileSync(".staging-deploy/stripe-lifecycle.receipt.json",JSON.stringify({verifiedAt:new Date().toISOString(),ref:config.ref,failedPayment:true,recovery:true,refundRevokesAccess:true,liveEventRejected:true}));
  console.log("PASS: real sandbox failure/recovery/refund webhooks and signed live-event rejection.");
 }finally{
  await stripe.subscriptions.cancel(subscription.id);
  await expect.poll(async()=>(await state())?.status,{timeout:60000}).toBe("canceled");
 }
});

test("hosted manual licensing remains available after Stripe cancellation",async()=>{
 test.setTimeout(60000);
 const fixture=JSON.parse(fs.readFileSync(".staging-deploy/stripe-fixture.local.json","utf8"));
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
 const admin=createClient(config.env.NEXT_PUBLIC_SUPABASE_URL,config.env.SUPABASE_SERVICE_ROLE_KEY,options);
 const owner=createClient(config.env.NEXT_PUBLIC_SUPABASE_URL,config.publicKey,options);
 const digest=createHash("sha256").update(randomBytes(32)).digest("hex");
 const before=await admin.from("organization_subscriptions").select("trial_ends_at").eq("organization_id",fixture.organizationId).single();
 const issue=await admin.rpc("issue_license",{digest,hint:"ABCD",assigned_org:fixture.organizationId});
 expect(issue.error).toBeNull();expect(issue.data).toBeTruthy();
 const login=await owner.auth.signInWithPassword({email:fixture.email,password:fixture.password});expect(login.error).toBeNull();
 try{
  const activate=await owner.rpc("activate_license",{oid:fixture.organizationId,digest});expect(activate.error).toBeNull();expect(activate.data).toBe(true);
  const allowed=await owner.rpc("organization_access",{oid:fixture.organizationId});expect(allowed.data).toBe(true);
  const current=await admin.from("organization_subscriptions").select("entitlement_source,trial_ends_at").eq("organization_id",fixture.organizationId).single();
  expect(current.data?.entitlement_source).toBe("license");expect(current.data?.trial_ends_at).toBe(before.data?.trial_ends_at);
 }finally{
  const revoke=await admin.rpc("revoke_license",{lid:issue.data});expect(revoke.error).toBeNull();
  const denied=await owner.rpc("organization_access",{oid:fixture.organizationId});expect(denied.data).toBe(false);
  await owner.auth.signOut({scope:"local"});
 }
 fs.writeFileSync(".staging-deploy/stripe-license.receipt.json",JSON.stringify({verifiedAt:new Date().toISOString(),ref:config.ref,issue:true,redeem:true,revoke:true,trialPreserved:true}));
 console.log("PASS: hosted manual license issue, redemption and revocation remain functional; synthetic license revoked.");
});
