"use client";

import { useEffect, useRef, type ReactElement, type ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "cn";
import {
  readerFooterFade,
  tripDialogVariants,
  type TripDialogVariant,
} from "@/components/shared/trip-dialog-variants";

export function TripDialog({
  trigger,
  title,
  titleAccessory,
  titleAction,
  headerContent,
  description,
  children,
  footer,
  className,
  variant,
  navClassName,
  headerClassName,
  bodyClassName,
  footerClassName,
  readerClassName,
  backdropClassName,
  keepMounted = false,
  open,
  onOpenChange,
  busy = false,
  disablePointerDismissal = false,
  initialFocus,
  finalFocus,
  mobilePresentation = "fullscreen",
  presentation = "dialog",
  headerAction,
  backLabel = "Back to itinerary",
  onBack,
  focusTitleOnChange = false,
}: {
  trigger?: ReactElement;
  title: string;
  titleAccessory?: ReactNode;
  titleAction?: ReactNode;
  headerContent?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Detail drawers only; defaults to "reference". */
  variant?: TripDialogVariant;
  /** Extra classes for the slots TripDialog renders (nav and reader only in the detail presentation). */
  navClassName?: string;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  readerClassName?: string;
  backdropClassName?: string;
  keepMounted?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  busy?: boolean;
  disablePointerDismissal?: boolean;
  mobilePresentation?: "fullscreen" | "sheet";
  presentation?: "dialog" | "detail";
  headerAction?: ReactNode;
  backLabel?: string;
  onBack?: () => void;
  focusTitleOnChange?: boolean;
  initialFocus?: Dialog.Popup.Props["initialFocus"];
  finalFocus?: Dialog.Popup.Props["finalFocus"];
}) {
  const styles =
    presentation === "detail"
      ? tripDialogVariants[variant ?? "reference"]
      : undefined;
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (open && focusTitleOnChange) titleRef.current?.focus();
  }, [open, title, focusTitleOnChange]);
  const readingContent = (
    <>
      <div
        data-slot="trip-dialog-header"
        className={cn(
          styles
            ? "flex items-start justify-between gap-4 shrink-0 px-6 [&>div]:w-full"
            : "flex items-start justify-between gap-4 shrink-0 border-b px-6 py-4 md:p-6",
          styles?.header,
          headerClassName,
        )}
      >
        <div className="min-w-0 space-y-2">
          {!headerContent && titleAccessory}
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title
              ref={titleRef}
              tabIndex={-1}
              className={
                headerContent
                  ? "sr-only"
                  : "min-w-0 break-words text-xl leading-tight font-semibold tracking-tight"
              }
            >
              {title}
            </Dialog.Title>
            {titleAction}
          </div>
          {description && (
            <Dialog.Description
              className={
                headerContent
                  ? "sr-only"
                  : "break-words text-sm leading-6 text-muted-foreground"
              }
            >
              {description}
            </Dialog.Description>
          )}
          {headerContent}
        </div>
        {presentation !== "detail" && (
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
        )}
      </div>
      <div
        data-slot="trip-dialog-body"
        className={cn(
          "min-h-0 overflow-y-auto overscroll-contain p-6 has-[>.activity-form]:pb-0 has-[>.ledger-form]:pb-0",
          !footer && "rounded-b-[inherit]",
          styles?.body,
          bodyClassName,
        )}
      >
        {children}
      </div>
    </>
  );
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
        <Dialog.Backdrop
          forceRender={!!backdropClassName}
          className={cn(
            "dialog-backdrop fixed inset-0 z-50 transition-opacity duration-[180ms] ease-out data-starting-style:opacity-0 data-ending-style:opacity-0 [&[hidden]]:hidden",
            backdropClassName ?? "bg-black/30",
          )}
        />
        <Dialog.Popup
          initialFocus={initialFocus}
          finalFocus={finalFocus}
          data-mobile-presentation={mobilePresentation}
          data-presentation={presentation}
          className={cn(
            "trip-dialog fixed inset-0 z-50 flex h-dvh flex-col bg-card pt-[env(safe-area-inset-top,0px)] pr-[env(safe-area-inset-right,0px)] pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] shadow-xl outline-none transition-opacity duration-200 ease-out [--form-surface:var(--card)] data-starting-style:opacity-0 data-ending-style:opacity-0 data-[mobile-presentation=sheet]:top-auto data-[mobile-presentation=sheet]:h-auto data-[mobile-presentation=sheet]:max-h-[calc(100dvh-env(safe-area-inset-top,0px)-16px)] data-[mobile-presentation=sheet]:rounded-t-3xl data-[mobile-presentation=sheet]:rounded-b-none [&[hidden]]:hidden max-md:[&_[data-slot='calendar']]:w-full max-md:[&_[data-slot='calendar']]:max-w-full max-md:[&_[data-slot='calendar']]:p-0 max-md:[&_[data-slot='calendar']]:[--cell-size:40px] max-md:[&_[data-slot='calendar']_.rdp-day]:min-w-0 max-md:[&_[data-slot='calendar']_.rdp-day]:flex-1 max-md:[&_[data-slot='calendar']_.rdp-day]:aspect-auto max-md:[&_[data-slot='calendar']_button[data-day]]:h-12 max-md:[&_[data-slot='calendar']_button[data-day]]:w-full max-md:[&_[data-slot='calendar']_button[data-day]]:min-w-0 max-md:[&_[data-slot='calendar']_button[data-day]]:aspect-auto max-md:[&_[data-slot='calendar']_.rdp-month_caption]:h-12 max-md:[&_[data-slot='calendar']_.rdp-dropdown_root]:flex max-md:[&_[data-slot='calendar']_.rdp-dropdown_root]:min-h-11 max-md:[&_[data-slot='calendar']_.rdp-dropdown_root]:items-center md:inset-auto md:top-1/2 md:left-1/2 md:h-auto md:max-h-[calc(100dvh-48px)] md:w-[calc(100%-48px)] md:max-w-[672px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl md:p-0 md:data-[mobile-presentation=sheet]:top-1/2 md:data-[mobile-presentation=sheet]:max-h-[calc(100dvh-48px)] md:data-[mobile-presentation=sheet]:rounded-3xl",
            // Detail presentation is a right-hand drawer from md up.
            presentation === "detail" &&
              "bg-background md:inset-[0_0_0_auto] md:h-dvh md:max-h-dvh md:w-[min(680px,100%)] md:max-w-none md:translate-x-0 md:translate-y-0 md:rounded-[1.5rem_0_0_1.5rem]",
            className,
          )}
        >
          {presentation === "detail" && (
            <div
              className={cn(
                "activity-detail-navigation flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4",
                styles?.nav,
                navClassName,
              )}
            >
              {onBack ? (
                <Button variant="ghost" disabled={busy} onClick={onBack}>
                  <ArrowLeft aria-hidden="true" className="size-3.5" />
                  {backLabel}
                </Button>
              ) : (
                <Dialog.Close
                  disabled={busy}
                  render={<Button variant="ghost" />}
                >
                  <ArrowLeft aria-hidden="true" className="size-3.5" />
                  {backLabel}
                </Dialog.Close>
              )}
              {headerAction}
            </div>
          )}
          {presentation === "detail" ? (
            <div
              data-slot="trip-dialog-reader"
              className={cn(
                "activity-detail-reader min-h-0 flex-1 overflow-y-auto overscroll-contain",
                styles?.reader,
                footer && variant !== "expense" && readerFooterFade,
                readerClassName,
              )}
            >
              {readingContent}
            </div>
          ) : (
            readingContent
          )}
          {footer && (
            <div
              data-slot="trip-dialog-footer"
              className={cn(
                "shrink-0 rounded-b-[inherit] border-t px-6 py-4",
                styles?.footer,
                footerClassName,
              )}
            >
              {footer}
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
