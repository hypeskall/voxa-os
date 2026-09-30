import Link from "next/link";
import { requireClinic } from "@/features/auth/access";
import { saveMember } from "@/features/settings/actions";
import { PageHeading, Table } from "@/components/ui/page";
import { Field, Input, Select } from "@/components/ui/form";
import { ActionForm } from "@/components/ui/action-form";
import { Panel } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { can, roles } from "@/lib/permissions";
export const metadata = { title: "Echipă și acces" };
export default async function Team({
  params,
  searchParams,
}: {
  params: Promise<{ clinicId: string }>;
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { clinicId } = await params;
  const { client, permissions } = await requireClinic(clinicId, "members.read");
  const search = await searchParams;
  const page = Math.floor(
    Math.max(1, Math.min(10000, Number(search.page) || 1)),
  );
  const q = (search.q ?? "").slice(0, 100);
  let query = client
    .from("clinic_memberships")
    .select("id,user_id,role,active,profiles!inner(full_name)", {
      count: "exact",
    })
    .eq("clinic_id", clinicId)
    .order("created_at")
    .order("id");
  if (q)
    query = query.ilike("profiles.full_name", `%${q.replace(/[%_\\]/g, "")}%`);
  const { data, count, error } = await query.range(
    (page - 1) * 25,
    page * 25 - 1,
  );
  if (error) throw new Error("Echipa nu a putut fi încărcată.");
  const members = data;
  return (
    <>
      <PageHeading
        eyebrow="ADMINISTRARE"
        title="Echipă și acces"
        description="Apartenența și rolurile utilizatorilor în clinică."
        action={
          can(permissions, "members.manage") ? (
            <Panel
              title="Acordă sau modifică accesul"
              description="Utilizați emailul unui cont existent. Modificarea se aplică acestei clinici."
              trigger={<Button>Gestionează accesul</Button>}
            >
              <ActionForm
                action={saveMember.bind(null, clinicId)}
                submit="Aplică accesul"
              >
                <Field label="Email utilizator">
                  <Input
                    name="email"
                    type="email"
                    required
                    autoComplete="off"
                  />
                </Field>
                <Field label="Rol">
                  <Select name="role" defaultValue="RECEPTION">
                    {roles
                      .filter(
                        (r) =>
                          r !== "OWNER" ||
                          can(permissions, "organization.manage"),
                      )
                      .map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                  </Select>
                </Field>
                <Field label="Stare acces">
                  <Select name="active">
                    <option value="true">Activ</option>
                    <option value="false">Revocat</option>
                  </Select>
                </Field>
              </ActionForm>
            </Panel>
          ) : undefined
        }
      />
      <div className="toolbar">
        <p className="muted">{count ?? 0} utilizatori</p>
        <form>
          <Input
            name="q"
            aria-label="Caută după nume"
            placeholder="Caută după nume"
            defaultValue={q}
          />
          <Button variant="outline">Caută</Button>
        </form>
      </div>
      <Table>
        <thead>
          <tr>
            <th>Utilizator</th>
            <th>Rol</th>
            <th>Acces</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id}>
              <td>
                <strong>{m.profiles.full_name || "Nume necompletat"}</strong>
              </td>
              <td>{m.role}</td>
              <td>
                <span className={`status ${m.active ? "" : "inactive"}`}>
                  {m.active ? "Activ" : "Revocat"}
                </span>
              </td>
            </tr>
          ))}
          {!members.length && (
            <tr>
              <td colSpan={3} className="table-empty">
                Nu există utilizatori pentru criteriile selectate.
              </td>
            </tr>
          )}
        </tbody>
      </Table>
      <div className="pagination">
        {page > 1 ? (
          <Link
            className="text-link"
            href={`?page=${page - 1}&q=${encodeURIComponent(q)}`}
          >
            Pagina anterioară
          </Link>
        ) : (
          <span />
        )}
        {(count ?? 0) > page * 25 && (
          <Link
            className="text-link"
            href={`?page=${page + 1}&q=${encodeURIComponent(q)}`}
          >
            Pagina următoare
          </Link>
        )}
      </div>
      <p className="note">
        Rolurile sunt acordate în cadrul clinicii. Administratorii nu pot
        atribui rolul OWNER sau modifica accesul unui proprietar.
      </p>
    </>
  );
}
