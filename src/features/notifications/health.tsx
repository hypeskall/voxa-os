import { z } from "zod";
import { requireClinic } from "@/features/auth/access";
import { T, LocaleDate } from "@/components/locale-provider";
import { Section } from "@/components/ui/page";
const schema = z.object({
  due: z.number(),
  overdue: z.number(),
  stale_sending: z.number(),
  exhausted: z.number(),
  last_sent_at: z.string().nullable(),
});
export async function NotificationHealth({ cid }: { cid: string }) {
  const { client, clinic } = await requireClinic(cid, "notifications.read");
  const { data, error } = await client.rpc("notification_health", { cid });
  if (error) throw new Error("Starea cozii nu a putut fi verificată.");
  const health = schema.parse(data);
  return (
    <Section title="Starea cozii de mesaje">
      <p>
        <T>{"Mesaje de procesat"}</T>: {health.due} · <T>{"Întârziate"}</T>:{" "}
        {health.overdue} · <T>{"Procesări blocate"}</T>: {health.stale_sending}{" "}
        · <T>{"Încercări epuizate"}</T>: {health.exhausted}
      </p>
      <p>
        <T>{"Ultimul mesaj acceptat de furnizor"}</T>:{" "}
        <LocaleDate
          value={health.last_sent_at}
          options={{
            dateStyle: "short",
            timeStyle: "short",
            timeZone: clinic.timezone,
          }}
        />
      </p>
      {(health.overdue > 0 || health.stale_sending > 0) && (
        <p className="message error" role="alert">
          <T>
            {
              "Coada necesită verificarea administratorului. Consultați jurnalul și monitorizarea workerului."
            }
          </T>
        </p>
      )}
      <p className="muted">
        <T>
          {
            "Acceptarea de către furnizor nu confirmă citirea sau livrarea la destinatar. Mesajele de test sunt marcate separat."
          }
        </T>
      </p>
    </Section>
  );
}
