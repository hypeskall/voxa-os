"use client";
import { useLocale } from "@/components/locale-provider";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
const variants = cva("button", {
  variants: {
    variant: {
      default: "button-primary",
      outline: "button-outline",
      ghost: "button-ghost",
      destructive: "button-danger",
    },
    size: { default: "", sm: "button-sm", icon: "button-icon" },
  },
  defaultVariants: { variant: "default", size: "default" },
});
export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof variants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "button";
  const { t } = useLocale();
  const localized = { ...props };
  if (localized["aria-label"]) localized["aria-label"] = t(localized["aria-label"]);
  if (localized.title) localized.title = t(localized.title);
  if (!asChild && typeof localized.children === "string") localized.children = t(localized.children);
  return (
    <Component
      className={cn(variants({ variant, size }), className)}
      {...localized}
    />
  );
}
