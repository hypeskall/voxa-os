import fs from "node:fs";
import {randomBytes} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
import {stagingEnv} from "./staging-env.mjs";
const config=stagingEnv();
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
try{
 if(config.ref!=="wlnrfjrjkyywqyvsngps")throw Error("Unexpected staging target");
 const file=".staging-deploy/stripe-fixture.local.json";
 if(fs.existsSync(file)){console.log("Existing isolated Stripe fixture retained.");process.exit(0);}
 const admin=createClient(config.env.NEXT_PUBLIC_SUPABASE_URL,config.env.SUPABASE_SERVICE_ROLE_KEY,options);
 const email=`stripe-sandbox-${randomBytes(5).toString("hex")}@voxa.test`,password=randomBytes(24).toString("base64url")+"aA1!";
 const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:"Stripe Sandbox Synthetic Owner"}});
 if(created.error)throw Error("Synthetic owner creation failed");
 const user=createClient(config.env.NEXT_PUBLIC_SUPABASE_URL,config.publicKey,options);
 const login=await user.auth.signInWithPassword({email,password});if(login.error)throw Error("Synthetic login failed");
 const clinic=await user.rpc("create_organization",{org_name:"STRIPE SANDBOX SYNTHETIC",clinic_name:"STRIPE SANDBOX SYNTHETIC"});
 if(clinic.error||!clinic.data)throw Error("Synthetic organization creation failed");
 const org=await admin.from("clinics").select("organization_id").eq("id",clinic.data).single();
 if(org.error)throw Error("Synthetic organization lookup failed");
 const organizationId=org.data.organization_id;
 const update=await admin.from("organizations").update({onboarding_completed:true}).eq("id",organizationId).eq("name","STRIPE SANDBOX SYNTHETIC");
 if(update.error)throw Error("Synthetic organization setup failed");
 const expired=await admin.from("organization_subscriptions").update({trial_started_at:new Date(Date.now()-31*86400000).toISOString(),trial_ends_at:new Date(Date.now()-86400000).toISOString()}).eq("organization_id",organizationId);
 if(expired.error)throw Error("Synthetic trial expiry failed");
 fs.writeFileSync(file,JSON.stringify({email,password,userId:created.data.user.id,organizationId,clinicId:clinic.data,createdAt:new Date().toISOString()},null,2));
 await user.auth.signOut({scope:"local"});
 console.log("PASS: isolated synthetic Stripe organization prepared, trial expired only for that fixture; no patient data or email sending.");
}catch(error){console.error(error.message);process.exitCode=1;}
