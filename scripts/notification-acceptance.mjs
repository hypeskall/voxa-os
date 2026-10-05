import fs from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { readEnv } from "./staging-env.mjs";
import { managementQuery } from "./staging-schema.mjs";

// A single deliberately synthetic message goes to the existing controlled inbox.
// Re-running prepare preserves the job/key; it never creates another delivery.
const env = readEnv(".env.production.local");
const ref = "fibcbsdattoqiyizzeda";
if (env.NEXT_PUBLIC_SUPABASE_URL !== `https://${ref}.supabase.co` || env.APP_ORIGIN !== "https://voxa-os.vercel.app")
  throw new Error("Unexpected notification acceptance target.");
const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const file = ".staging-deploy/notification-acceptance.local.json";
const key = "notification-acceptance:2026-10-05:scheduled-email";
const recipient = "contact@voxatech.ro";
function checked(result) { if (result.error) throw new Error("Notification acceptance operation failed; sensitive diagnostics suppressed."); return result.data; }

try {
  const mode = process.argv[2];
  if (mode === "prepare") {
    if (fs.existsSync(file)) { console.log("Existing notification acceptance retained; no new message queued."); process.exit(0); }
    if (env.NOTIFICATION_DELIVERY_ENABLED !== "true" || env.NOTIFICATION_PROVIDER !== "smtp")
      throw new Error("Production SMTP delivery must be deployed first.");
    const clinics = checked(await client.from("clinics").select("organization_id").is("archived_at", null).limit(1));
    if (clinics.length !== 1) throw new Error("Existing organization unavailable.");
    const organizationId = clinics[0].organization_id;
    const fixture = { organizationId, clinicId: randomUUID(), patientId: randomUUID(), jobId: randomUUID(), createdAt: new Date().toISOString() };
    // Persist IDs before mutation so an interrupted preparation is inspectable.
    fs.mkdirSync(".staging-deploy", {recursive:true}); fs.writeFileSync(file, JSON.stringify(fixture));
    checked(await client.from("clinics").insert({id:fixture.clinicId, organization_id:organizationId, name:"Voxa-OS · test tehnic notificări"}));
    checked(await client.from("patients").insert({id:fixture.patientId, organization_id:organizationId, clinic_id:fixture.clinicId,
      name:"Destinatar sintetic test notificări", internal_id:"NOTIFICATION-ACCEPTANCE-2026-10-05", email:recipient}));
    checked(await client.from("communication_templates").update({subject:"Voxa-OS · test notificare automată",
      body:"Acesta este un test tehnic al notificărilor automate Voxa-OS, trimis prin programarea la fiecare cinci minute. Locație fictivă: {{clinic_name}}. Mesajul nu privește un pacient sau o programare reală.", active:true})
      .eq("clinic_id",fixture.clinicId).eq("event","APPOINTMENT_CREATED").eq("channel","EMAIL"));
    checked(await client.from("notification_jobs").insert({id:fixture.jobId, organization_id:organizationId, clinic_id:fixture.clinicId,
      patient_id:fixture.patientId, event:"APPOINTMENT_CREATED", channel:"EMAIL", recipient, idempotency_key:key}));
    checked(await client.from("communication_logs").insert({organization_id:organizationId,clinic_id:fixture.clinicId,job_id:fixture.jobId,
      patient_id:fixture.patientId,event:"APPOINTMENT_CREATED",channel:"EMAIL",status:"QUEUED",recipient_masked:"c***@voxatech.ro"}));
    console.log("PASS: one synthetic email queued for the existing controlled inbox; the normal scheduler will deliver it.");
  } else if (mode === "status") {
    const fixture=JSON.parse(fs.readFileSync(file,"utf8"));
    const job=checked(await client.from("notification_jobs").select("status,attempts,sent_at,provider_message_id,last_error").eq("id",fixture.jobId).single());
    const log=checked(await client.from("communication_logs").select("status,attempts,sent_at").eq("job_id",fixture.jobId).single());
    const digest=createHash("sha256").update(`patient-notification:${key}`).digest("hex");
    const ledger=await managementQuery(ref,env.SUPABASE_ACCESS_TOKEN,`select status from private.transactional_email_deliveries where digest='${digest}';`);
    console.log(JSON.stringify({job:{status:job.status,attempts:job.attempts,sentAt:job.sent_at,providerAcknowledged:Boolean(job.provider_message_id),errorPresent:Boolean(job.last_error)},log,ledger}));
    if (job.status==="SENT" && ledger[0]?.status==="accepted" && log.status==="SENT") {
      fs.writeFileSync(".staging-deploy/notification-acceptance.receipt.json",JSON.stringify({verifiedAt:new Date().toISOString(),ref,scheduledDelivery:true,smtpAccepted:true,inboxConfirmed:false,attempts:job.attempts}));
      console.log("PASS: scheduler delivered the controlled message; job, communication log and durable SMTP acceptance agree. Inbox receipt needs the owner.");
    }
  } else if(mode === "archive") {
    const fixture=JSON.parse(fs.readFileSync(file,"utf8"));
    const job=checked(await client.from("notification_jobs").select("status").eq("id",fixture.jobId).single());
    if(job.status!=="SENT")throw new Error("Finish acceptance before archiving the fixture.");
    const archived_at=new Date().toISOString();
    checked(await client.from("patients").update({archived_at}).eq("id",fixture.patientId));
    checked(await client.from("clinics").update({archived_at}).eq("id",fixture.clinicId));
    console.log("PASS: synthetic notification location/patient archived; delivery evidence retained.");
  } else throw new Error("Use prepare, status or archive.");
} catch { console.error("Notification acceptance failed; sensitive diagnostics suppressed. Inspect the isolated fixture before retrying."); process.exitCode=1; }
