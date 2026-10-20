"use client";

import { type ReactElement, type ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TripDialog({ trigger, title, description, children, keepMounted = false, open, onOpenChange, busy = false, disablePointerDismissal = false, initialFocus, finalFocus, mobilePresentation = "fullscreen" }: {
  trigger?: ReactElement; title: string; description: string; children: ReactNode;
  keepMounted?: boolean; open?: boolean; onOpenChange?: (open: boolean) => void;
  busy?: boolean; disablePointerDismissal?: boolean; mobilePresentation?: "fullscreen" | "sheet";
  initialFocus?: Dialog.Popup.Props["initialFocus"]; finalFocus?: Dialog.Popup.Props["finalFocus"];
}) {
  return <Dialog.Root open={open} disablePointerDismissal={disablePointerDismissal} onOpenChange={(next, details) => {
    if (!next && busy) { details.cancel(); return; }
    onOpenChange?.(next);
  }}>
    {trigger && <Dialog.Trigger render={trigger} />}
    <Dialog.Portal keepMounted={keepMounted}>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm data-closed:hidden" />
      <Dialog.Popup initialFocus={initialFocus} finalFocus={finalFocus} data-mobile-presentation={mobilePresentation} className="trip-dialog fixed z-50 flex flex-col bg-card shadow-xl outline-none data-closed:hidden">
        <div className="flex items-start justify-between gap-4 shrink-0 border-b px-6 py-4 md:p-6">
          <div className="min-w-0 space-y-2"><Dialog.Title className="font-heading text-2xl leading-tight tracking-tight">{title}</Dialog.Title><Dialog.Description className="text-sm leading-6 text-muted-foreground">{description}</Dialog.Description></div>
          <Dialog.Close disabled={busy} render={<Button variant="ghost" className="size-11 shrink-0" aria-label="Close dialog" />}><X aria-hidden="true" /></Dialog.Close>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-6">{children}</div>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>;
}
