import fs from "node:fs";
import { spawnSync } from "node:child_process";
import nodemailer from "nodemailer";
import { readEnv, stagingEnv } from "./staging-env.mjs";

const staging = process.argv[3] === "staging";
const envFile = staging ? ".env.staging.local" : ".env.production.local";
const env = staging ? stagingEnv().env : readEnv(envFile);
const smtp = readEnv(".env.staging.local");
const origin = staging ? "https://voxa-os-staging-voxa6.vercel.app" : "https://voxa-os.vercel.app";
const ref = staging ? "wlnrfjrjkyywqyvsngps" : "fibcbsdattoqiyizzeda";
if (env.APP_ORIGIN !== origin || env.NEXT_PUBLIC_SUPABASE_URL !== `https://${ref}.supabase.co`)
  throw new Error("Named launch target mismatch.");
const token = env.SUPABASE_ACCESS_TOKEN;
const mail = {host:smtp.STAGING_SMTP_HOST,port:Number(smtp.STAGING_SMTP_PORT),user:smtp.STAGING_SMTP_USER,pass:smtp.STAGING_SMTP_PASSWORD,from:smtp.STAGING_SMTP_SENDER};
if (mail.host !== "smtp.zoho.eu" || mail.port !== 587 || mail.from !== "contact@voxatech.ro" || !mail.user || !mail.pass)
  throw new Error("Expected the existing verified Zoho sender.");
const transport = () => nodemailer.createTransport({host:mail.host,port:mail.port,secure:false,requireTLS:true,tls:{minVersion:"TLSv1.2",rejectUnauthorized:true},auth:{user:mail.user,pass:mail.pass},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,logger:false,debug:false});
function save(values) {
  const names=Object.keys(values);
  const lines=fs.readFileSync(envFile,"utf8").split(/\r?\n/).filter(line=>!names.some(k=>line.startsWith(k+"=")));
  fs.writeFileSync(envFile,lines.join("\n")+"\n"+Object.entries(values).map(([k,v])=>`${k}=${v}`).join("\n")+"\n");
}
function vercel(key,value,secret) {
  const args=["--yes","vercel@62.2.0","env","add",key,staging?"preview":"production","--project",staging?"voxa-os-staging":"voxa-os","--scope","voxa6","--force",secret?"--sensitive":"--no-sensitive","--yes"];
  const result=process.platform==="win32"
    ?spawnSync(process.env.ComSpec||"cmd.exe",["/d","/s","/c","npx "+args.join(" ")],{input:value,env:process.env,encoding:"utf8",timeout:90000})
    :spawnSync("npx",args,{input:value,env:process.env,encoding:"utf8",timeout:90000});
  if(result.status!==0||result.error)throw new Error(`Vercel configuration failed for ${key}; sensitive output suppressed.`);
  console.log(`Configured ${key} on ${staging?"staging Preview":"production"}.`);
}
try {
  const mode=process.argv[2];
  if(mode==="smtp-check") {
    const client=transport();try{await client.verify();}finally{client.close();}
    console.log("PASS: existing Zoho SMTP authentication over verified STARTTLS. No email sent.");
  } else if(mode==="auth") {
    const client=transport();try{await client.verify();}finally{client.close();}
    const config={site_url:origin,uri_allow_list:`${origin}/auth/callback,${origin}/auth/callback?next=**`,
      disable_signup:false,mailer_autoconfirm:false,external_email_enabled:true,external_anonymous_users_enabled:false,password_min_length:12,
      smtp_host:mail.host,smtp_port:String(mail.port),smtp_user:mail.user,smtp_pass:mail.pass,smtp_admin_email:mail.from,smtp_sender_name:"Voxa-OS",
      mailer_templates_confirmation_content:fs.readFileSync("supabase/templates/staging-confirm-signup.html","utf8"),
      mailer_templates_recovery_content:fs.readFileSync("supabase/templates/staging-recovery.html","utf8"),
      mailer_templates_magic_link_content:fs.readFileSync("supabase/templates/staging-magic-link.html","utf8"),
      mailer_templates_invite_content:fs.readFileSync("supabase/templates/staging-auth-invite.html","utf8")};
    const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`,{method:"PATCH",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(config),signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw new Error(`Auth configuration failed (HTTP ${response.status}); response suppressed.`);
    const check=await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(30000)});
    if(!check.ok)throw new Error("Auth configuration readback failed.");
    const actual=await check.json();
    for(const key of Object.keys(config).filter(key=>!['smtp_pass'].includes(key)))if(actual[key]!==config[key])throw new Error(`Auth configuration mismatch: ${key}`);
    console.log(`PASS: ${staging?"staging":"production"} Auth sender, confirmation, recovery templates, 12-character policy and bounded callbacks saved and verified. Inbox delivery still needs a controlled real signup.`);
  } else if(mode==="vercel") {
    // Staging needs no SMTP credentials: its app uses manual invitations and
    // development notifications. Do not copy production mail secrets there.
    const values=staging ? {APP_ENVIRONMENT:"staging",APP_ORIGIN:origin,VOXA_SUPPORT_EMAIL:mail.from,
      STAFF_INVITATION_PROVIDER:"manual",NOTIFICATION_PROVIDER:"development",NOTIFICATION_DELIVERY_ENABLED:"false"}
      : {APP_ENVIRONMENT:"production",APP_ORIGIN:origin,VOXA_SUPPORT_EMAIL:mail.from,
      STAFF_INVITATION_PROVIDER:"smtp",SMTP_HOST:mail.host,SMTP_PORT:String(mail.port),SMTP_USER:mail.user,SMTP_PASSWORD:mail.pass,SMTP_FROM:mail.from,
      ERROR_ALERT_EMAIL:mail.from,NOTIFICATION_PROVIDER:"smtp",NOTIFICATION_DELIVERY_ENABLED:"false"};
    save(values);
    for(const [key,value] of Object.entries(values))if(value)vercel(key,value,key==="SMTP_PASSWORD");
  } else throw new Error("Use smtp-check, auth or vercel [staging].");
}catch(error){console.error(error.message && !/password|token|recipient/i.test(error.message)?error.message:"Launch configuration failed; sensitive diagnostics suppressed.");process.exitCode=1;}
