"use client";

import { type ReactElement, type ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

export function TripDialog({
  trigger,
  title,
  description,
  children,
  footer,
  className,
  keepMounted = false,
  open,
  onOpenChange,
  busy = false,
  disablePointerDismissal = false,
  initialFocus,
  finalFocus,
  mobilePresentation = "fullscreen",
}: {
  trigger?: ReactElement;
  title: string;
  description: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  keepMounted?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  busy?: boolean;
  disablePointerDismissal?: boolean;
  mobilePresentation?: "fullscreen" | "sheet";
  initialFocus?: Dialog.Popup.Props["initialFocus"];
  finalFocus?: Dialog.Popup.Props["finalFocus"];
}) {
  return (
    <Dialog.Root
      open={open}
      disablePointerDismissal={disablePointerDismissal}
      onOpenChange={(next, details) => {
        if (!next && busy) {
          details.cancel();
          return;
        }
        onOpenChange?.(next);
      }}
    >
      {trigger && <Dialog.Trigger render={trigger} />}
      <Dialog.Portal keepMounted={keepMounted}>
        <Dialog.Backdrop className="dialog-backdrop fixed inset-0 z-50 bg-black/30" />
        <Dialog.Popup
          initialFocus={initialFocus}
          finalFocus={finalFocus}
          data-mobile-presentation={mobilePresentation}
          className={cn(
            "trip-dialog fixed z-50 flex flex-col bg-card shadow-xl outline-none",
            className,
          )}
        >
          <div
            data-slot="trip-dialog-header"
            className="flex items-start justify-between gap-4 shrink-0 border-b px-6 py-4 md:p-6"
          >
            <div className="min-w-0 space-y-2">
              <Dialog.Title className="break-words text-xl leading-tight font-semibold tracking-tight">
                {title}
              </Dialog.Title>
              <Dialog.Description className="break-words text-sm leading-6 text-muted-foreground">
                {description}
              </Dialog.Description>
            </div>
            <Dialog.Close
              disabled={busy}
              render={
                <Button
                  variant="ghost"
                  className="size-11 shrink-0"
                  aria-label="Close dialog"
                />
              }
            >
              <X aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div
            data-slot="trip-dialog-body"
            className={cn(
              "min-h-0 overflow-y-auto overscroll-contain p-6 has-[>.activity-form]:pb-0",
              !footer && "rounded-b-[inherit]",
            )}
          >
            {children}
          </div>
          {footer && (
            <div
              data-slot="trip-dialog-footer"
              className="shrink-0 rounded-b-[inherit] border-t px-6 py-4"
            >
              {footer}
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
