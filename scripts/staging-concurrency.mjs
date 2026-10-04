import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { stagingEnv } from "./staging-env.mjs";
const config=stagingEnv();
const actors=JSON.parse(fs.readFileSync(".staging-actors.local.json","utf8"));
const actor=actors.a;
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(30000)})}};
const client=createClient(config.env.NEXT_PUBLIC_SUPABASE_URL,config.publicKey,options);
let created;
try {
  const login=await client.auth.signInWithPassword({email:actor.email,password:actor.password});
  if(login.error)throw new Error("Controlled staging owner could not sign in.");
  const services=await client.from("services").select("id").eq("clinic_id",actor.clinicId).eq("active",true).is("archived_at",null).limit(1);
  if(services.error||!services.data?.length)throw new Error("Synthetic staging service missing.");
  const sid=services.data[0].id;
  const patient=await client.from("patients").select("id").eq("id",actor.patientId).eq("clinic_id",actor.clinicId).single();
  if(patient.error)throw new Error("Controlled staging patient missing.");
  const after=new Date(Date.now()+7*86400000),before=new Date(Date.now()+14*86400000);
  const slots=await client.rpc("get_available_slots",{cid:actor.clinicId,sid,window_start:after.toISOString(),window_end:before.toISOString(),doctor_id:null,step_minutes:15});
  if(slots.error||!Array.isArray(slots.data)||!slots.data.length)throw new Error("No synthetic staging slot available.");
  const slot=slots.data[0];
  const sessions=Array.from({length:12},()=>createClient(config.env.NEXT_PUBLIC_SUPABASE_URL,config.publicKey,{...options,global:{...options.global,headers:{Authorization:`Bearer ${login.data.session.access_token}`}}}));
  const started=Date.now();
  const results=await Promise.all(sessions.map(c=>c.rpc("create_appointment",{cid:actor.clinicId,payload:{patient_id:actor.patientId,service_id:sid,start_at:slot.start_at,doctor_id:slot.doctor_id,room_id:slot.room_id,equipment_ids:[],source:"API",notes:"Voxa hosted concurrency acceptance: synthetic fixture"}})));
  const winners=results.filter(r=>!r.error&&r.data?.ok&&r.data?.appointment_id);
  created=winners[0]?.data;
  const rejected=results.filter(r=>!r.error&&r.data?.ok===false&&((r.data.conflicts?.length??0)>0||r.data.requires_override===true));
  if(winners.length!==1||rejected.length!==11)throw new Error(`Concurrent scheduling result invalid (${winners.length} accepted, ${rejected.length} explicit conflicts).`);
  const count=await client.from("appointments").select("id").eq("clinic_id",actor.clinicId).eq("start_at",slot.start_at).neq("status","CANCELLED");
  if(count.error||count.data.length!==1)throw new Error("Concurrent scheduling inserted more than one active booking.");
  console.log(`PASS: 12 simultaneous hosted PostgREST requests, exactly one booking and 11 explicit conflict responses (${Date.now()-started}ms). This is a targeted race test, not a full capacity benchmark.`);
}catch(error){console.error(error.message);process.exitCode=1;}
finally{
  if(created){
    const saved=await client.from("appointments").select("updated_at").eq("id",created.appointment_id).single();
    const cancel=await client.rpc("cancel_appointment",{cid:actor.clinicId,aid:created.appointment_id,reason:"Completed synthetic concurrency acceptance",expected_updated_at:saved.data?.updated_at});
    if(cancel.error||!cancel.data?.ok){console.error("Synthetic booking cleanup failed; operator review required.");process.exitCode=1;}else console.log("PASS: synthetic winning booking canceled through the normal audited workflow.");
  }
  await client.auth.signOut({scope:"local"});
}
