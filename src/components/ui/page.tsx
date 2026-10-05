import { T } from "@/components/locale-provider";
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <p className="eyebrow"><T>{eyebrow}</T></p>
        <h1><T>{title}</T></h1>
        <p className="muted"><T>{description}</T></p>
      </div>
      {action}
    </header>
  );
}
export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="section">
      <div className="section-heading">
        <h2>{title}</h2>
        {description && <p className="muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}
export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="table-scroll" tabIndex={0}>
      <table>{children}</table>
    </div>
  );
}
