import { ArrowRight, CalendarDays, ContactRound, Workflow } from "lucide-react";
import { T } from "@/components/locale-provider";

const steps = [
  {
    title: "Alegi un interval disponibil",
    body: "Calendarul ține cont de medic, serviciu și resursele necesare.",
    icon: CalendarDays,
  },
  {
    title: "Recepția coordonează programarea",
    body: "Detaliile, confirmarea și reprogramarea rămân în același context.",
    icon: Workflow,
  },
  {
    title: "Medicul are istoricul la îndemână",
    body: "Profilul pacientului reunește programări, documente și rezultate.",
    icon: ContactRound,
  },
];
export function WorkflowStory() {
  return (
    <section
      id="cum-functioneaza"
      className="marketing-container marketing-section cinema-workflow"
      aria-labelledby="home-workflow-title"
    >
      <div className="marketing-section-heading" data-reveal>
        <div>
          <span className="marketing-eyebrow">
            <T>{"DE LA PROGRAMARE LA PACIENT"}</T>
          </span>
          <h2 id="home-workflow-title">
            <T>{"Un flux firesc."}</T>
            <br />
            <T>{"Pentru întreaga echipă."}</T>
          </h2>
        </div>
        <p>
          <T>
            {
              "Fiecare pas are locul lui. Informația însoțește pacientul, iar echipa știe unde să o găsească."
            }
          </T>
        </p>
      </div>
      <ol className="cinema-process-cards" data-stagger>
        {steps.map(({ title, body, icon: Icon }, index) => (
          <li key={title} data-reveal="depth">
            <span className="cinema-process-number">
              0{index + 1}
              <ArrowRight size={20} />
            </span>
            <Icon size={28} strokeWidth={1.3} />
            <h3>
              <T>{title}</T>
            </h3>
            <p>
              <T>{body}</T>
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
