// Test-only auth/Phase 1 protocol fixture. Phase 2 RPCs execute real migrations
// in PostgreSQL with the authenticated role. Never imported by production.
import http from "node:http";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { migratedDatabase, callerQuery } from "../support/database.ts";
const database = await migratedDatabase();
const authRequestCounts = { recover: 0, verify: 0 };
await database.exec(readFileSync("supabase/seed-core.sql", "utf8"));
const accounts = new Map([
  ["owner@voxa.test", { id: "10000000-0000-4000-8000-000000000001", password: "VoxaDev!2026", name: "Alexandra Ionescu" }],
  ["reception@voxa.test", { id: "10000000-0000-4000-8000-000000000003", password: "VoxaDev!2026", name: "Maria Pop" }],
]);
const rpcArgs = {
  organization_access: ["oid"],
  activate_license: ["oid", "digest"],
  create_organization: ["org_name", "clinic_name"],
  create_clinic: ["oid", "clinic_name", "clinic_address", "clinic_timezone"],
  create_location: ["oid", "payload"],
  save_onboarding: ["oid", "draft", "next_step", "expected_revision"],
  finish_onboarding: ["oid", "expected_revision", "invite_digests"],
  create_staff_invite: ["cid", "target_email", "target_role", "digest"],
  accept_staff_invite: ["digest"],
  revoke_staff_invite: ["iid"],
  doctor_calendar_colors: ["cid"],
  add_patient_note: ["cid", "pid", "note_content"],
  read_workflow_patient: ["cid", "pid"],
  my_doctor_schedule: ["cid", "day_from", "day_to"],
  request_patient_privacy: ["cid", "pid", "kind", "reason_value"],
  review_privacy_request: ["cid", "rid", "decision", "review"],
  save_organization_identity: ["oid", "payload"],
  set_membership: ["cid", "target_email", "target_role", "is_active"],
  list_core: [
    "cid",
    "module",
    "query",
    "state",
    "sort_key",
    "descending",
    "page_number",
    "filter_id",
  ],
  read_core: ["cid", "module", "entity_id"],
  core_options: ["cid", "module", "query", "selected"],
  save_core: ["cid", "module", "entity_id", "payload", "expected_updated_at"],
  save_doctor: ["cid", "entity_id", "payload", "expected_updated_at"],
  attach_doctor: ["source_clinic", "source_id", "target_clinic"],
  archive_core: ["cid", "module", "entity_id", "restore"],
  patient_history: ["cid", "pid"],
  my_permissions: ["cid"],
  list_calendar_appointments: ["cid", "range_start", "range_end", "filters"],
  read_appointment: ["cid", "aid"],
  update_appointment_notes: ["cid", "aid", "new_notes", "expected_updated_at"],
  get_available_slots: ["cid", "sid", "window_start", "window_end", "doctor_id", "step_minutes"],
  get_reschedule_slots: ["cid", "aid", "window_start", "window_end", "doctor_id", "step_minutes"],
  resize_appointment: ["cid", "aid", "new_duration_minutes", "expected_updated_at"],
  create_appointment: ["cid", "payload"],
  reschedule_appointment: ["cid", "aid", "payload", "expected_updated_at"],
  cancel_appointment: ["cid", "aid", "reason", "expected_updated_at"],
  set_appointment_status: ["cid", "aid", "next_status", "expected_updated_at"],
  issue_appointment_confirmation: ["cid", "aid", "token_digest", "token_public_id", "expires"],
  list_patient_documents: ["cid", "pid"],
  list_medical_results: ["cid", "pid"],
  read_doctor_credentials: ["cid", "did"],
  operational_dashboard: ["cid", "local_day"],
  tomorrow_whatsapp_reminders: ["cid", "local_day"],
  open_whatsapp_reminder: ["cid", "aid"],
  reports_summary: ["cid", "date_from", "date_to", "doctor_filter", "service_filter"],
  global_search: ["cid", "search_query", "result_limit"],
  record_report_export: ["cid", "date_from", "date_to"],
  save_clinic_weekly_schedule: ["cid", "payload"],
};
const publicRpcArgs = {
  list_public_booking_clinics: [],
  public_booking_catalog: ["slug"],
  public_available_slots: ["slug", "sid", "day", "doctor_id", "request_key"],
  create_public_booking: ["slug", "payload", "request_key"],
};
const oid = "20000000-0000-4000-8000-000000000001";
const owner = "10000000-0000-4000-8000-000000000001",
  reception = "10000000-0000-4000-8000-000000000003";
const first = "30000000-0000-4000-8000-000000000001",
  second = "30000000-0000-4000-8000-000000000002";
const clinics = [
  {
    id: first,
    organization_id: oid,
    name: "Oradea · Centru",
    address: "Str. Exemplului 10, Oradea",
    phone: "+40 359 000 000",
    whatsapp_reminder_template: "Bună, {patient_first_name}! Vă reamintim programarea din {date}, ora {time}, la {clinic_name}.",
    timezone: "Europe/Bucharest",
    public_booking_enabled: true,
    booking_slug: "clinica-centru",
    scheduling_increment_minutes: 15,
    calendar_visible_start: "08:00:00",
    calendar_visible_end: "20:00:00",
  },
  {
    id: second,
    organization_id: oid,
    name: "Oradea · Nord",
    address: "Str. Exemplului 22, Oradea",
    phone: "+40 359 000 000",
    whatsapp_reminder_template: "Bună, {patient_first_name}! Vă reamintim programarea din {date}, ora {time}, la {clinic_name}.",
    timezone: "Europe/Bucharest",
    public_booking_enabled: false,
    booking_slug: null,
    scheduling_increment_minutes: 15,
    calendar_visible_start: "08:00:00",
    calendar_visible_end: "20:00:00",
  },
];
let preferences = { density: "compact", default_clinic_id: null, calendar_view: "week", calendar_filters: {}, visible_columns: { patients: ["internal_id", "phone", "email"] }, dashboard_modules: ["metrics", "upcoming", "alerts", "activity"] };
function user(id) {
  const account = [...accounts.entries()].find(([, value]) => value.id === id);
  return {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: account?.[0] ?? "unknown@voxa.test",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {
      full_name: account?.[1].name ?? "Utilizator test",
    },
    created_at: "2026-01-01T00:00:00Z",
  };
}
function token(id) {
  return (
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ) +
    "." +
    Buffer.from(
      JSON.stringify({
        sub: id,
        role: "authenticated",
        aud: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      }),
    ).toString("base64url") +
    ".test"
  );
}
http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    let body = "";
    for await (const chunk of req) body += chunk;
    const input = body ? JSON.parse(body) : {};
    let resultCount = 2;
    const send = (data, status = 200) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Content-Range": resultCount ? `0-${resultCount - 1}/${resultCount}` : "*/0",
      });
      res.end(JSON.stringify(data));
    };
    if (url.pathname === "/health") return send({ ok: true });
    if (url.pathname === "/test/auth-request-counts") return send(authRequestCounts);
    if (url.pathname === "/test/product-demo" && req.method === "POST") {
      const cid="30000000-0000-4000-8000-000000000001",oid="20000000-0000-4000-8000-000000000001";
      await database.query("update public.organizations set name='Clinica Meridian · Demo' where id=$1",[oid]);
      const service=(await database.query("select id from public.services where clinic_id=$1 order by created_at limit 1",[cid])).rows[0].id;
      const doctor=(await database.query("select id from public.doctor_locations where clinic_id=$1 order by created_at limit 1",[cid])).rows[0].id;
      const patients=(await database.query("select id from public.patients where clinic_id=$1 order by name limit 15",[cid])).rows;
      const demoDay=new Date(); demoDay.setUTCDate(demoDay.getUTCDate()+7); while(demoDay.getUTCDay()!==1) demoDay.setUTCDate(demoDay.getUTCDate()+1);
      const firstDay=demoDay.toISOString().slice(0,10);
      // Populate the actual daily dashboard with fictional bookings, including weekend captures.
      // This endpoint belongs only to the local screenshot fixture.
      const today=(await database.query("select (now() at time zone 'Europe/Bucharest')::date::text as demo_date, extract(isodow from (now() at time zone 'Europe/Bucharest'))::integer as demo_weekday")).rows[0];
      await database.query(`insert into public.availability_rules(organization_id,clinic_id,name,resource_kind,doctor_location_id,room_id,equipment_id,weekday,start_time,end_time,valid_from,interval_kind)
        select a.organization_id,a.clinic_id,'Program demonstrativ',a.resource_kind,a.doctor_location_id,a.room_id,a.equipment_id,$2,a.start_time,a.end_time,a.valid_from,a.interval_kind
        from public.availability_rules a where a.clinic_id=$1 and a.weekday=1 and a.active and a.archived_at is null and a.interval_kind='work'
        and not exists(select 1 from public.availability_rules b where b.clinic_id=a.clinic_id and b.resource_kind=a.resource_kind and b.doctor_location_id is not distinct from a.doctor_location_id and b.room_id is not distinct from a.room_id and b.equipment_id is not distinct from a.equipment_id and b.weekday=$2 and b.active and b.archived_at is null and b.interval_kind='work')`,[cid,today.demo_weekday]);
      for(let index=0;index<3;index++) {
        const start=(await database.query("select ($1::date+make_interval(hours=>$2::integer,mins=>30)) at time zone 'Europe/Bucharest' start_at",[today.demo_date,9+index*2])).rows[0].start_at;
        // Historical rows are seed data; booking actions correctly reject times in the past.
        await database.query("insert into public.appointments(organization_id,clinic_id,patient_id,service_id,doctor_location_id,start_at,end_at,occupied_start_at,occupied_end_at,duration_minutes,buffer_before,buffer_after,status,source,notes,created_by) values($1,$2,$3,$4,$5,$6::timestamptz,$6::timestamptz+interval '30 minutes',$6::timestamptz,$6::timestamptz+interval '30 minutes',30,0,0,$7::public.appointment_status,'RECEPTION','Date demonstrative.',$8)",[oid,cid,patients[index].id,service,doctor,start,index===0?'PENDING':'CONFIRMED',owner]);
      }
      for(let index=0;index<15;index++) {
        const day=new Date(demoDay); day.setUTCDate(day.getUTCDate()+Math.floor(index/3)); const hour=9+(index%3)*2;
        const start=(await database.query("select ($1::date+make_interval(hours=>$2::integer,mins=>30)) at time zone 'Europe/Bucharest' start_at",[day.toISOString().slice(0,10),hour])).rows[0].start_at;
        const result=await callerQuery(database,"10000000-0000-4000-8000-000000000001","select public.create_appointment($1,$2::jsonb) result",[cid,JSON.stringify({patient_id:patients[index].id,service_id:service,doctor_id:doctor,start_at:start,status:index%3===0?'PENDING':'CONFIRMED',source:'RECEPTION',notes:'Date demonstrative.'})]);
        if(!result.rows[0].result.ok) return send({error:'Product demo booking failed',result:result.rows[0].result},500);
      }
      return send({ok:true,date:firstDay});
    }
    // Local protocol fixture only; these controls are never served by Next.js.
    if (url.pathname === "/test/subscription" && req.method === "POST") {
      const organization = "20000000-0000-4000-8000-000000000001";
      if (input.expired) await database.query("update public.organization_subscriptions set status='trialing',entitlement_source=null,license_key_id=null,current_period_start=null,current_period_end=null,trial_started_at=now()-interval '31 days',trial_ends_at=now()-interval '1 day' where organization_id=$1", [organization]);
      else await database.query("update public.organization_subscriptions set status='trialing',entitlement_source=null,license_key_id=null,current_period_start=null,current_period_end=null,trial_started_at=now(),trial_ends_at=now()+interval '30 days' where organization_id=$1", [organization]);
      const code=`VOXA-${randomBytes(16).toString('hex').toUpperCase().match(/.{4}/g).join('-')}`;
      await database.query("insert into public.license_keys(code_hash,code_hint,organization_id,status,redeem_by) values($1,$2,$3,'assigned',now()+interval '30 days')",[createHash('sha256').update(code).digest('hex'),code.slice(-4),organization]);
      return send({code});
    }
    let uid;
    try {
      uid = JSON.parse(
        Buffer.from(
          (req.headers.authorization ?? "").split(".")[1],
          "base64url",
        ).toString(),
      ).sub;
    } catch {
      uid = null;
    }
    if (url.pathname === "/auth/v1/token") {
      const account = accounts.get(input.email);
      if (!account || input.password !== account.password)
        return send(
          { code: "invalid_credentials", msg: "Invalid credentials" },
          400,
        );
      const id = account.id;
      return send({
        access_token: token(id),
        refresh_token: "test-refresh",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: user(id),
      });
    }
    if (url.pathname === "/auth/v1/signup") {
      if(accounts.has(input.email)) return send({ code:"user_already_exists",msg:"Account exists" },400);
      const id=randomUUID(); accounts.set(input.email,{id,password:input.password,name:input.data?.full_name??"Utilizator test"});
      await database.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)",[id,input.email,input.data??{}]);
      // Fixture confirms the address; hosted verification/SMTP is separately tested.
      return send(user(id));
    }
    if(url.pathname === "/auth/v1/recover") { authRequestCounts.recover++; return send({}); }
    if(url.pathname === "/auth/v1/verify") { authRequestCounts.verify++; return send({code:"otp_expired",msg:"Token has expired or is invalid"},403); }
    if (url.pathname === "/auth/v1/user")
      { if(uid&&req.method==="PUT"&&input.password){const account=[...accounts.values()].find(a=>a.id===uid);if(account)account.password=input.password;} return uid ? send(user(uid)) : send({ msg: "Not authenticated" }, 401); }
    if (url.pathname === "/auth/v1/logout") return send({});
    const table = url.pathname.replace("/rest/v1/", "");
    const rpc = table.replace(/^rpc\//, "");
    if (!uid && table.startsWith("rpc/") && Object.hasOwn(publicRpcArgs, rpc)) {
      const keys = publicRpcArgs[rpc].filter((key) => Object.hasOwn(input, key));
      try {
        const result = await database.transaction(async (tx) => {
          await tx.exec("set local role anon");
          return tx.query(
            `select public.${rpc}(${keys.map((key, index) => `${key} => $${index + 1}`).join(",")}) as result`,
            keys.map((key) => input[key]),
          );
        });
        return send(result.rows[0].result);
      } catch (error) {
        return send({ code: error.code, message: error.message }, 400);
      }
    }
    if (!uid) return send({ message: "No session" }, 401);
    const isOwner = uid === owner;
    const allowed = clinics.filter((c) => isOwner || c.id === first);
    const eq = (key) => url.searchParams.get(key)?.replace(/^eq\./, "");
    const object = req.headers.accept?.includes(
      "application/vnd.pgrst.object+json",
    );
    const rows = (data) => {
      resultCount=data.length;
      return object
        ? data[0]
          ? send(data[0])
          : send({ code: "PGRST116", message: "No rows" }, 406)
        : send(data);
    };
    if (table === "rpc/record_login") return send(null);
    if (table.startsWith("rpc/") && Object.hasOwn(rpcArgs, rpc)) {
      const keys = rpcArgs[rpc].filter((k) => Object.hasOwn(input, k));
      try {
        const result = await callerQuery(
          database,
          uid,
          `select public.${rpc}(${keys.map((k, i) => `${k} => $${i + 1}`).join(",")}) as result`,
          keys.map((k) => input[k]),
        );
        return send(
          rpc === "my_permissions"
            ? result.rows.map((r) => r.result)
            : result.rows[0].result,
        );
      } catch (error) {
        return send({ code: error.code, message: error.message }, 400);
      }
    }
    if (table === "clinics") {
      if(uid!==owner&&uid!==reception){
        const values=[];let sql="select * from public.clinics where true";
        for(const key of ["id","organization_id"])if(eq(key)){values.push(eq(key));sql+=` and ${key}=$${values.length}`;}
        return rows((await callerQuery(database,uid,sql+" order by name",values)).rows);
      }
      const data = allowed.filter((c) => !eq("id") || eq("id") === c.id);
      if (req.method === "PATCH" && isOwner)
        data.forEach((c) => Object.assign(c, input));
      return rows(data);
    }
    if (table === "profiles")
      return rows([{ id: uid, full_name: user(uid).user_metadata.full_name }]);
    if (table === "doctor_services") {
      const result = await callerQuery(database, uid,
        "select doctor_location_id,service_id from public.doctor_services where clinic_id=$1", [eq("clinic_id")]);
      return rows(result.rows);
    }
    if (["organizations","organization_members","onboarding_drafts","organization_invites","patient_notes","privacy_requests","organization_settings","organization_subscriptions","subscription_events","license_keys"].includes(table)) {
      const values=[];let sql=`select ${table==="organization_invites"?"id,organization_id,clinic_id,email,role,expires_at,accepted_at,revoked_at,invited_by,created_at":table==="license_keys"?"id,organization_id,code_hint,status,plan,expires_at,activated_at,created_at,updated_at":"*"} from public.${table} where true`;
      for(const key of ["id","organization_id","user_id","clinic_id","patient_id"])if(eq(key)){values.push(eq(key));sql+=` and ${key}=$${values.length}`;}
      return rows((await callerQuery(database,uid,sql,values)).rows);
    }
    if (table === "user_preferences") {
      if(uid!==owner&&uid!==reception){return rows((await callerQuery(database,uid,"select * from public.user_preferences where user_id=$1",[uid])).rows);}
      if (req.method === "POST") preferences = { ...preferences, ...input };
      return object ? send(preferences) : send([preferences]);
    }
    if (table === "clinic_memberships") {
      if(uid!==owner&&uid!==reception){
        const values=[];let sql="select m.*,jsonb_build_object('full_name',p.full_name) profiles from public.clinic_memberships m join public.profiles p on p.id=m.user_id where true";
        for(const key of ["user_id","clinic_id"])if(eq(key)){values.push(eq(key));sql+=` and m.${key}=$${values.length}`;}
        return rows((await callerQuery(database,uid,sql,values)).rows);
      }
      if (eq("user_id"))
        return rows(
          allowed.some((c) => c.id === eq("clinic_id"))
            ? [{ role: isOwner ? "OWNER" : "RECEPTION" }]
            : [],
        );
      return rows([
        {
          id: "40000000-0000-4000-8000-000000000001",
          user_id: owner,
          role: "OWNER",
          active: true,
          profiles: { full_name: "Alexandra Ionescu" },
        },
        {
          id: "40000000-0000-4000-8000-000000000002",
          user_id: reception,
          role: "RECEPTION",
          active: true,
          profiles: { full_name: "Maria Pop" },
        },
      ]);
    }
    if (table === "audit_logs")
      return rows([
        {
          id: "50000000-0000-4000-8000-000000000001",
          action: "update",
          entity: "clinics",
          entity_id: first,
          created_at: "2026-09-28T10:30:00Z",
          actor_id: owner,
          clinic_id: first,
          metadata: { fields: ["address"] },
          profiles: { full_name: "Alexandra Ionescu" },
        },
      ]);
    return send({ message: "Unsupported UI fixture operation" }, 400);
  })
  .listen(54329, "127.0.0.1");
