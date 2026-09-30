import { cn } from "@/lib/utils";
export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn("input", className)} {...props} />;
}
export function Select({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return <select className={cn("input", className)} {...props} />;
}
export function Field({
  label,
  children,
  hint,
  hintId,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  hintId?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small id={hintId}>{hint}</small>}
    </label>
  );
}
