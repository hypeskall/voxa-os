import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { stagingEnv } from "./staging-env.mjs";
const config=stagingEnv();
const authPath=process.platform==="win32"?path.join(process.env.APPDATA,"com.vercel.cli","Data","auth.json"):path.join(process.env.HOME,".local/share/com.vercel.cli/auth.json");
const auth=JSON.parse(fs.readFileSync(authPath,"utf8"));
const endpoint="https://api.vercel.com/v1/projects/voxa-os-staging/protection-bypass?slug=voxa6";
const mode=process.argv[2];
try{
 if(!["create","revoke"].includes(mode))throw new Error("Use create or revoke.");
 const secret=mode==="create"?randomBytes(16).toString("hex"):config.env.STAGING_PREVIEW_BYPASS_SECRET;
 if(!secret)throw new Error("No staging automation credential to revoke.");
 const response=await fetch(endpoint,{method:"PATCH",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},
  body:JSON.stringify(mode==="create"?{generate:{secret,note:"Temporary Voxa release acceptance; revoke immediately after tests"}}:{revoke:{secret,regenerate:false}}),signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error(`Staging automation access failed (HTTP ${response.status}); body suppressed.`);
 const body=await response.json();
 if(mode==="create"&&!body.protectionBypass?.[secret])throw new Error("Automation access was not acknowledged.");
 const file=process.env.STAGING_ENV_FILE||".env.staging.local";
 const lines=fs.readFileSync(file,"utf8").split(/\r?\n/).filter(line=>!line.startsWith("STAGING_PREVIEW_BYPASS_SECRET="));
 if(mode==="create")lines.push("STAGING_PREVIEW_BYPASS_SECRET="+secret);
 fs.writeFileSync(file,lines.join("\n")+"\n");
 console.log(`PASS: temporary staging automation access ${mode==="create"?"created locally":"revoked and removed locally"}; project deployment protection retained.`);
}catch(error){console.error(error.message);process.exitCode=1;}
