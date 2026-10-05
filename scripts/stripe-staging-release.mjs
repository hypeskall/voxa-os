import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { stagingEnv } from "./staging-env.mjs";
const config=stagingEnv();
const root=path.resolve(".");
const releaseRelative=`.staging-deploy/stripe-release-${Date.now()}`;
const folder=path.join(root,releaseRelative);
const auth=JSON.parse(fs.readFileSync(path.join(process.env.APPDATA,"com.vercel.cli","Data","auth.json"),"utf8"));
const project=JSON.parse(fs.readFileSync(".staging-deploy/stripe-project.local.json","utf8"));
function cli(args,cwd=root){
  if(args.some(a=>!/^[A-Za-z0-9_.@/=-]+$/.test(a)))throw Error("Unsafe CLI argument");
  const r=spawnSync(process.env.ComSpec||"cmd.exe",["/d","/s","/c",["npx","--yes","vercel@62.2.0",...args].join(" ")],{cwd,encoding:"utf8",timeout:300000});
  if(r.error||r.status!==0)throw Error("Staging CLI failed; raw output suppressed");
  return r.stdout;
}
try{
 if(config.ref!=="wlnrfjrjkyywqyvsngps"||project.projectName!=="voxa-os-staging")throw Error("Unexpected staging target");
 if(process.argv[2]==="configure"){
  const keys=["STRIPE_BILLING_ENABLED","STRIPE_SECRET_KEY","STRIPE_ACCOUNT_ID","STRIPE_PRICE_ID","STRIPE_WEBHOOK_SECRET","STRIPE_PORTAL_CONFIGURATION_ID"];
  if(!config.env.STRIPE_WEBHOOK_SECRET||config.env.STRIPE_BILLING_ENABLED!=="true")throw Error("Sandbox setup is incomplete");
  const env=keys.map(key=>({key,value:config.env[key],type:/SECRET/.test(key)?"sensitive":"encrypted",target:["preview"]}));
  const r=await fetch(`https://api.vercel.com/v10/projects/${project.projectId}/env?slug=voxa6&upsert=true`,{method:"POST",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify(env),signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw Error(`Staging environment configuration failed (HTTP ${r.status})`);
  console.log("PASS: Stripe sandbox variables configured only for staging Preview; server secrets marked sensitive.");
 }else if(process.argv[2]==="deploy"){
  if(fs.existsSync(folder))throw Error("Release snapshot already exists; use the existing deployment or inspect it before retrying");
  fs.mkdirSync(folder,{recursive:true});
  const files=spawnSync("git",["ls-files","--cached","--others","--exclude-standard"],{encoding:"utf8"});
  if(files.status!==0)throw Error("Cannot inventory release files");
  for(const relative of files.stdout.trim().split(/\r?\n/)){
   const from=path.resolve(root,relative),to=path.resolve(folder,relative);
   if(!from.startsWith(root+path.sep)||!to.startsWith(folder+path.sep)||!fs.existsSync(from)||!fs.statSync(from).isFile())throw Error("Invalid snapshot path");
   fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to);
  }
  fs.mkdirSync(path.join(folder,".vercel"),{recursive:true});fs.writeFileSync(path.join(folder,".vercel","project.json"),JSON.stringify(project));
  const hosting=JSON.parse(fs.readFileSync(path.join(folder,"vercel.json"),"utf8"));
  hosting.regions=["fra1"]; // Staging database is in eu-central-1; production is in eu-west-1.
  fs.writeFileSync(path.join(folder,"vercel.json"),JSON.stringify(hosting,null,2));
  const output=cli(["deploy",releaseRelative,"--yes","--scope","voxa6","--no-clipboard"]);
  const url=output.match(/https:\/\/voxa-os-staging-[a-z0-9-]+-voxa6\.vercel\.app/)?.[0];
  if(!url)throw Error("Deployment URL not acknowledged");
  fs.writeFileSync(".staging-deploy/stripe-deployment.local.json",JSON.stringify({url,createdAt:new Date().toISOString()}));
  cli(["alias","set",url.replace("https://",""),new URL(config.origin).hostname,"--scope","voxa6"]);
  console.log("PASS: sandbox integration deployed to the protected staging alias; production was not deployed.");
 }else throw Error("Use configure or deploy");
}catch(error){console.error(error.message);process.exitCode=1;}
