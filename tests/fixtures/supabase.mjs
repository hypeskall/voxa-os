// Test-only auth/Phase 1 protocol fixture. Phase 2 RPCs execute real migrations
// in PostgreSQL with the authenticated role. Never imported by production.
import http from "node:http";
import { readFileSync } from "node:fs";
import { migratedDatabase, callerQuery } from "../support/database.ts";
const database = await migratedDatabase();
await database.exec(readFileSync("supabase/seed-core.sql", "utf8"));
const rpcArgs = {
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
  return {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: id === owner ? "owner@voxa.test" : "reception@voxa.test",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {
      full_name: id === owner ? "Alexandra Ionescu" : "Maria Pop",
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
    const send = (data, status = 200) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Content-Range": "0-1/2",
      });
      res.end(JSON.stringify(data));
    };
    if (url.pathname === "/health") return send({ ok: true });
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
      if (input.password !== "VoxaDev!2026")
        return send(
          { code: "invalid_credentials", msg: "Invalid credentials" },
          400,
        );
      const id = input.email === "reception@voxa.test" ? reception : owner;
      return send({
        access_token: token(id),
        refresh_token: "test-refresh",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: user(id),
      });
    }
    if (url.pathname === "/auth/v1/user")
      return uid ? send(user(uid)) : send({ msg: "Not authenticated" }, 401);
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
    const rows = (data) =>
      object
        ? data[0]
          ? send(data[0])
          : send({ code: "PGRST116", message: "No rows" }, 406)
        : send(data);
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
      const data = allowed.filter((c) => !eq("id") || eq("id") === c.id);
      if (req.method === "PATCH" && isOwner)
        data.forEach((c) => Object.assign(c, input));
      return rows(data);
    }
    if (table === "profiles")
      return rows([{ id: uid, full_name: isOwner ? "Alexandra Ionescu" : "Maria Pop" }]);
    if (table === "organizations")
      return rows([{ name: "Clinica Maria · date fictive" }]);
    if (table === "user_preferences") {
      if (req.method === "POST") preferences = { ...preferences, ...input };
      return object ? send(preferences) : send([preferences]);
    }
    if (table === "clinic_memberships") {
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
