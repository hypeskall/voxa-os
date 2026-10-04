import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
const db = new PGlite();
const owner = "10000000-0000-4000-8000-000000000001",
  admin = "10000000-0000-4000-8000-000000000002",
  reception = "10000000-0000-4000-8000-000000000003",
  doctor = "10000000-0000-4000-8000-000000000004",
  assistant = "10000000-0000-4000-8000-000000000005",
  outsider = "10000000-0000-4000-8000-000000000006";
const org = "20000000-0000-4000-8000-000000000001",
  otherOrg = "20000000-0000-4000-8000-000000000002";
const a = "30000000-0000-4000-8000-000000000001",
  b = "30000000-0000-4000-8000-000000000002",
  c = "30000000-0000-4000-8000-000000000003";
async function asUser<T>(
  uid: string | null,
  fn: () => Promise<T>,
  role = "authenticated",
) {
  await db.exec("begin");
  try {
    await db.exec(`set local role ${role}`);
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
      uid ?? "",
    ]);
    return await fn();
  } finally {
    await db.exec("rollback");
  }
}
beforeAll(async () => {
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; create schema auth;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create table auth.mfa_factors(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),status text not null);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
  for (const file of readdirSync("supabase/migrations").sort())
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  for (const [i, uid] of [
    owner,
    admin,
    reception,
    doctor,
    assistant,
    outsider,
  ].entries())
    await db.query("insert into auth.users(id,email) values($1,$2)", [
      uid,
      `user${i}@test.local`,
    ]);
  await db.query(
    "insert into public.organizations(id,name) values($1,$2),($3,$4)",
    [org, "Organization A", otherOrg, "Organization B"],
  );
  await db.query(
    "insert into public.clinics(id,organization_id,name) values($1,$2,$3),($4,$2,$5),($6,$7,$8)",
    [a, org, "Clinic A", b, "Clinic B", c, otherOrg, "Clinic C"],
  );
  for (const [i, uid] of [owner, admin, reception, doctor, assistant].entries())
    await db.query(
      "insert into public.clinic_memberships(user_id,organization_id,clinic_id,role) values($1,$2,$3,$4)",
      [uid, org, a, ["OWNER", "ADMIN", "RECEPTION", "DOCTOR", "ASSISTANT"][i]],
    );
  await db.query(
    "insert into public.clinic_memberships(user_id,organization_id,clinic_id,role) values($1,$2,$3,'OWNER'),($4,$5,$6,'OWNER')",
    [owner, org, b, outsider, otherOrg, c],
  );
});
afterAll(async () => {
  await db.close();
});
describe("Real PostgreSQL policies against migrated schema", () => {
  it("enables RLS on every public table", async () => {
    const { rows } = await db.query<{ relname: string }>(
      "select relname from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relkind='r' and not relrowsecurity",
    );
    expect(rows).toEqual([]);
  });
  it("isolates clinics in SAME organization and other organizations", async () =>
    asUser(reception, async () => {
      const { rows } = await db.query<{ id: string }>(
        "select id from public.clinics",
      );
      expect(rows.map((r) => r.id)).toEqual([a]);
      expect(
        (await db.query("select * from public.clinics where id=$1", [b])).rows,
      ).toHaveLength(0);
      expect(
        (await db.query("select * from public.organizations")).rows,
      ).toHaveLength(1);
    }));
  it("allows owner only assigned locations, never other tenant", async () =>
    asUser(owner, async () => {
      expect(
        (await db.query("select * from public.clinics")).rows,
      ).toHaveLength(2);
      expect(
        (
          await db.query("select * from public.profiles where id=$1", [
            outsider,
          ])
        ).rows,
      ).toHaveLength(0);
    }));
  it.each([reception, doctor, assistant])(
    "least privilege for role %s",
    async (uid) =>
      asUser(uid, async () => {
        expect(
          (await db.query("select * from public.audit_logs")).rows,
        ).toHaveLength(0);
        expect(
          (
            await db.query(
              "update public.clinics set name='Forbidden' where id=$1 returning id",
              [a],
            )
          ).rows,
        ).toHaveLength(0);
        expect(
          (await db.query("select * from public.profiles")).rows,
        ).toHaveLength(1);
        const permissions = (
          await db.query<{ p: string }>(
            "select public.my_permissions($1) as p",
            [a],
          )
        ).rows
          .map((r) => r.p)
          .sort();
        expect(permissions).toEqual(
          (uid === reception
            ? [
                "clinic.read",
                "patients.read",
                "patients.manage",
                "catalog.read",
                "availability.read",
                "appointments.read",
                "appointments.manage",
                "notifications.read",
                "documents.read",
                "documents.manage",
              ]
            : uid === doctor
              ? ["clinic.read", "catalog.read", "availability.read", "documents.read", "documents.manage", "results.read", "results.manage", "results.release", "credentials.manage"]
              : ["clinic.read", "catalog.read", "availability.read", "documents.read"]
          ).sort(),
        );
      }),
  );
  it("denies anonymous access", async () => {
    await expect(
      asUser(null, () => db.query("select * from public.clinics"), "anon"),
    ).rejects.toThrow();
  });
  it("blocks cross-tenant update even for admin", async () =>
    asUser(admin, async () => {
      expect(
        (
          await db.query(
            "update public.clinics set name='No' where id=$1 returning id",
            [c],
          )
        ).rows,
      ).toHaveLength(0);
    }));
  it("blocks reassignment of organization identity", async () => {
    await expect(
      asUser(owner, () =>
        db.query("update public.clinics set organization_id=$1 where id=$2", [
          otherOrg,
          a,
        ]),
      ),
    ).rejects.toThrow();
  });
  it("prevents direct role escalation", async () => {
    await expect(
      asUser(reception, () =>
        db.query(
          "update public.clinic_memberships set role='OWNER' where user_id=$1",
          [reception],
        ),
      ),
    ).rejects.toThrow();
  });
  it("prevents admin granting OWNER", async () => {
    await expect(
      asUser(admin, () =>
        db.query(
          "select public.set_membership($1,'user2@test.local','OWNER',true)",
          [a],
        ),
      ),
    ).rejects.toThrow("Owner required");
  });
  it("prevents admin modifying OWNER", async () => {
    await expect(
      asUser(admin, () =>
        db.query(
          "select public.set_membership($1,'user0@test.local','RECEPTION',false)",
          [a],
        ),
      ),
    ).rejects.toThrow("Owner required");
  });
  it("prevents self-access changes", async () => {
    await expect(
      asUser(owner, () =>
        db.query(
          "select public.set_membership($1,'user0@test.local','OWNER',false)",
          [a],
        ),
      ),
    ).rejects.toThrow("Cannot change own access");
  });
  it("blocks membership RPC on another clinic", async () => {
    await expect(
      asUser(admin, () =>
        db.query(
          "select public.set_membership($1,'user2@test.local','ADMIN',true)",
          [b],
        ),
      ),
    ).rejects.toThrow("Access denied");
  });
  it("enforces composite tenant foreign keys", async () => {
    await expect(
      db.query(
        "insert into public.clinic_memberships(user_id,organization_id,clinic_id,role) values($1,$2,$3,'ADMIN')",
        [admin, otherOrg, b],
      ),
    ).rejects.toThrow();
  });
  it("persists valid preferences but blocks another users preferences", async () => {
    await asUser(reception, async () => {
      await db.query(
        "insert into public.user_preferences(user_id,default_clinic_id,density) values($1,$2,'compact')",
        [reception, a],
      );
      expect(
        (await db.query("select * from public.user_preferences")).rows,
      ).toHaveLength(1);
    });
    await expect(
      asUser(reception, () =>
        db.query("insert into public.user_preferences(user_id) values($1)", [
          owner,
        ]),
      ),
    ).rejects.toThrow();
  });
  it("rejects inaccessible default location", async () => {
    await expect(
      asUser(reception, () =>
        db.query(
          "insert into public.user_preferences(user_id,default_clinic_id) values($1,$2)",
          [reception, b],
        ),
      ),
    ).rejects.toThrow();
  });
  it("supports PostgREST-style upsert of own preferences", async () =>
    asUser(reception, async () => {
      for (const density of ["compact", "comfortable"])
        await db.query(
          "insert into public.user_preferences(user_id,density) values($1,$2) on conflict(user_id) do update set user_id=excluded.user_id,density=excluded.density",
          [reception, density],
        );
      expect(
        (
          await db.query<{ density: string }>(
            "select density from public.user_preferences",
          )
        ).rows[0].density,
      ).toBe("comfortable");
    }));
  it("blocks changing preferences ownership", async () => {
    await expect(
      asUser(reception, async () => {
        await db.query(
          "insert into public.user_preferences(user_id) values($1)",
          [reception],
        );
        await db.query("update public.user_preferences set user_id=$1", [
          owner,
        ]);
      }),
    ).rejects.toThrow();
  });
  it("audits organization changes across its locations", async () =>
    asUser(owner, async () => {
      await db.query(
        "update public.organizations set name='Updated org' where id=$1",
        [org],
      );
      expect(
        (
          await db.query(
            "select * from public.audit_logs where entity='organizations'",
          )
        ).rows,
      ).toHaveLength(2);
    }));
  it("bootstraps an unassigned account with an owner membership", async () => {
    const fresh = "10000000-0000-4000-8000-000000000007";
    await db.query("insert into auth.users(id,email) values($1,$2)", [
      fresh,
      "fresh@test.local",
    ]);
    await asUser(fresh, async () => {
      const { rows } = await db.query<{ id: string }>(
        "select public.create_organization('New organization','First clinic') as id",
      );
      expect(
        (
          await db.query(
            "select role from public.clinic_memberships where clinic_id=$1",
            [rows[0].id],
          )
        ).rows,
      ).toEqual([{ role: "OWNER" }]);
    });
  });
  it("audits updates atomically without storing sensitive values", async () =>
    asUser(admin, async () => {
      await db.query(
        "update public.clinics set address='Sensitive address' where id=$1",
        [a],
      );
      const { rows } = await db.query<{ metadata: unknown }>(
        "select metadata from public.audit_logs where action='update' and entity='clinics'",
      );
      expect(rows).toHaveLength(1);
      expect(JSON.stringify(rows)).not.toContain("Sensitive address");
    }));
  it("denies audit forgery, edits and deletion", async () => {
    for (const sql of [
      "insert into public.audit_logs(organization_id,clinic_id,action,entity,entity_id) values($1,$2,'fake','clinics',$2)",
      "update public.audit_logs set action='fake' where organization_id=$1 and clinic_id=$2",
      "delete from public.audit_logs where organization_id=$1 and clinic_id=$2",
    ])
      await expect(
        asUser(owner, () => db.query(sql, [org, a])),
      ).rejects.toThrow();
  });
  it("creates clinic plus owner access transactionally", async () =>
    asUser(owner, async () => {
      const { rows } = await db.query<{ id: string }>(
        "select public.create_clinic($1,'New clinic','','Europe/Bucharest') as id",
        [org],
      );
      expect(
        (
          await db.query("select * from public.clinics where id=$1", [
            rows[0].id,
          ])
        ).rows,
      ).toHaveLength(1);
    }));
  it("denies unauthorized clinic creation", async () => {
    await expect(
      asUser(admin, () =>
        db.query(
          "select public.create_clinic($1,'No clinic','','Europe/Bucharest')",
          [org],
        ),
      ),
    ).rejects.toThrow("Access denied");
  });
  it("revocation takes effect without a new JWT", async () => {
    await db.exec("begin");
    try {
      await db.query(
        "update public.clinic_memberships set active=false where user_id=$1",
        [reception],
      );
      await db.exec("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        reception,
      ]);
      expect(
        (await db.query("select * from public.clinics")).rows,
      ).toHaveLength(0);
    } finally {
      await db.exec("rollback");
    }
  });
  it("prevents existing member creating another organization", async () => {
    await expect(
      asUser(owner, () =>
        db.query("select public.create_organization('New org','New clinic')"),
      ),
    ).rejects.toThrow("Organization already assigned");
  });
});
