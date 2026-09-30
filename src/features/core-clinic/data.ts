import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireClinic } from "@/features/auth/access";
import {
  coreRowSchema,
  listResultSchema,
  listInputSchema,
  modulePermission,
  moduleSpecs,
  optionSchema,
  valueIds,
  valueText,
  type CoreModule,
  type CoreRow,
  type ListInput,
  type Option,
} from "./model";
export async function listCore(
  cid: string,
  module: CoreModule,
  options: Partial<ListInput> = {},
) {
  const context = await requireClinic(cid, modulePermission(module, "read"));
  const input = listInputSchema.parse(options);
  const { data, error } = await context.client.rpc("list_core", {
    cid,
    module,
    ...input,
  });
  if (error) throw new Error("Lista nu a putut fi încărcată. Reîncercați.");
  return listResultSchema.parse(data);
}
export async function readCore(cid: string, module: CoreModule, id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const context = await requireClinic(cid, modulePermission(module, "read"));
  const { data, error } = await context.client.rpc("read_core", {
    cid,
    module,
    entity_id: id,
  });
  if (error) throw new Error("Înregistrarea nu a putut fi încărcată.");
  if (!data) notFound();
  return coreRowSchema.parse(data);
}
export async function optionsFor(
  cid: string,
  module: CoreModule,
  selected: string[] = [],
  query = "",
): Promise<Option[]> {
  const { client } = await requireClinic(cid, "catalog.read");
  const { data, error } = await client.rpc("core_options", {
    cid,
    module,
    selected,
    query,
  });
  if (error) throw new Error("Opțiunile nu au putut fi încărcate.");
  return z.array(optionSchema).parse(data);
}
export async function editorOptions(
  cid: string,
  module: CoreModule,
  row?: CoreRow,
) {
  const entries = await Promise.all(
    moduleSpecs[module].fields
      .filter((f) => f.source)
      .map(
        async (f) =>
          [
            f.key,
            await optionsFor(
              cid,
              f.source!,
              f.kind === "multiple"
                ? valueIds(row, f.key)
                : valueText(row, f.key)
                  ? [valueText(row, f.key)]
                  : [],
            ),
          ] as const,
      ),
  );
  return Object.fromEntries(entries);
}
export async function patientHistory(cid: string, id: string) {
  const { client } = await requireClinic(cid, "patients.read");
  const { data, error } = await client.rpc("patient_history", { cid, pid: id });
  if (error) throw new Error("Istoricul nu a putut fi încărcat.");
  return z
    .array(
      z.object({
        action: z.string(),
        created_at: z.string(),
        metadata: z.record(z.string(), z.json()),
      }),
    )
    .parse(data);
}
