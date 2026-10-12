"use client";
import { T,useLocale } from "@/components/locale-provider";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "./button";
import { useRef, useState } from "react";
export function Panel({
  trigger,
  title,
  description,
  children,
  drawer = false,
  open,
  onOpenChange,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
  drawer?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  const {t}=useLocale();
  function changeOpen(next: boolean) {
    if(!next&&content.current?.querySelector('form[data-pending="true"]'))return;
    if (!next && content.current?.querySelector('form[data-dirty="true"]') && !window.confirm(t("Aveți modificări nesalvate. Închideți formularul și renunțați la ele?"))) return;
    setInternalOpen(next);
    onOpenChange?.(next);
  }
  return (
    <Dialog.Root open={open ?? internalOpen} onOpenChange={changeOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          ref={content}
          className={drawer ? "dialog-content drawer" : "dialog-content"}
        >
          <Dialog.Title className="dialog-title"><T>{title}</T></Dialog.Title>
          <Dialog.Description className="muted">
            <T>{description}</T>
          </Dialog.Description>
          <Dialog.Close asChild>
            <Button
              variant="ghost"
              size="icon"
              className="dialog-close"
              aria-label="Închide"
            >
              <X size={18} />
            </Button>
          </Dialog.Close>
          <div className="dialog-body">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
