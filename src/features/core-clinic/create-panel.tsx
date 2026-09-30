"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/dialog";
import { CoreEditor } from "./editor";
import { moduleSpecs, type CoreModule, type Option } from "./model";

export function CoreCreatePanel({
  cid,
  module,
  options,
  timeZone,
  label,
  variant = "default",
  preset,
}: {
  cid: string;
  module: CoreModule;
  options: Record<string, Option[]>;
  timeZone: string;
  label?: string;
  variant?: "default" | "outline";
  preset?: { kind: string; id: string };
}) {
  const spec = moduleSpecs[module];
  return (
    <Panel
      drawer
      title={`${spec.singular} — creare`}
      description="Datele sunt validate și salvate în Clinica Maria."
      trigger={
        <Button variant={variant}>
          <Plus size={16} />
          {label ?? `Adaugă ${spec.singular.toLocaleLowerCase("ro-RO")}`}
        </Button>
      }
    >
      <CoreEditor
        cid={cid}
        module={module}
        options={options}
        timeZone={timeZone}
        preset={preset}
      />
    </Panel>
  );
}
