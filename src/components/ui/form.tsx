import { T, LocalizedElement } from "@/components/locale-provider";
import { cn } from "@/lib/utils";
export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <LocalizedElement as="input" className={cn("input", className)} {...props} />;
}
export function Select({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return <LocalizedElement as="select" className={cn("input", className)} {...props} />;
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
      <span><T>{label}</T></span>
      {children}
      {hint && <small id={hintId}><T>{hint}</T></small>}
    </label>
  );
}
