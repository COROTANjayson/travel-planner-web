"use client";

import { useRef, useState, type ReactElement, type ReactNode } from "react";
import { DotsThreeIcon } from "@phosphor-icons/react";
import { TripDialog } from "@/components/shared/trip-dialog";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

type Item = {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  /** One line of help under the label, beside a tinted icon tile. */
  detail?: string;
  destructive?: boolean;
  disabled?: boolean;
};

/**
 * The ⋯ menu: a popover from md up, and on phones a bottom sheet titled with
 * `name` (and `description`) whose rows are big enough to tap. `trigger` and
 * `triggerContent` replace the ⋯ button.
 */
export function OptionsMenu({
  name,
  description,
  disabled,
  items,
  trigger,
  triggerContent,
}: {
  name: string;
  description?: string;
  disabled?: boolean;
  items: Item[];
  trigger?: ReactElement;
  triggerContent?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  // The sheet focuses its first row (shown as the hover highlight), not the X.
  const firstRow = useRef<HTMLButtonElement>(null);
  const rows = (phone: boolean) =>
    items.map((item, index) => (
      <Button
        key={item.label}
        ref={phone && index === 0 ? firstRow : undefined}
        variant="ghost"
        disabled={disabled || item.disabled}
        // Corners nest in the popover (12px radius - 4px padding). Focus shows as the
        // hover highlight, not the thick ring, since opening the menu focuses the first item.
        className={`min-h-11 w-full justify-start gap-3 rounded-sm px-3 whitespace-normal text-left focus-visible:border-transparent focus-visible:ring-0 [&_svg:not([class*='size-'])]:size-[18px] ${phone ? "text-base font-normal" : ""} ${item.detail ? "h-auto rounded-lg py-2.5" : ""} ${item.destructive ? "text-destructive hover:bg-destructive/10 hover:text-destructive focus-visible:bg-destructive/10" : "focus-visible:bg-accent focus-visible:text-accent-foreground"}`}
        onClick={() => {
          setOpen(false);
          setSheet(false);
          item.onClick();
        }}
      >
        {item.detail ? (
          <>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary [&_svg]:size-5">
              {item.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base leading-[22px] font-semibold">
                {item.label}
              </span>
              <span className="block text-[13px] leading-5 text-muted-foreground">
                {item.detail}
              </span>
            </span>
          </>
        ) : item.icon ? (
          <>
            {item.icon}
            {item.label}
          </>
        ) : (
          item.label
        )}
      </Button>
    ));
  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (next && window.matchMedia("(max-width: 767px)").matches)
            return setSheet(true);
          setOpen(next);
        }}
      >
        <PopoverTrigger
          disabled={disabled}
          render={
            trigger ?? (
              <Button
                variant="ghost"
                className="size-11 min-h-11 shrink-0"
                aria-label={`More options for ${name}`}
              />
            )
          }
        >
          {triggerContent ?? <DotsThreeIcon aria-hidden="true" />}
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className={`max-w-[calc(100vw-3rem)] p-1 ${items.some((item) => item.detail) ? "w-80 gap-0.5" : "w-56 gap-0"}`}
        >
          <PopoverTitle className="sr-only">
            {trigger ? name : `Options for ${name}`}
          </PopoverTitle>
          {rows(false)}
        </PopoverContent>
      </Popover>
      {sheet && (
        <TripDialog
          open
          onOpenChange={setSheet}
          title={name}
          description={description}
          // Figma modal sheet: 22px title, no divider, and the screen behind
          // dimmed even when the menu sits inside another dialog (a drawer).
          itineraryStyle
          mobilePresentation="sheet"
          backdropClassName="bg-black/60"
          initialFocus={firstRow}
          bodyClassName="space-y-1 px-3 pt-4 pb-6"
        >
          {rows(true)}
        </TripDialog>
      )}
    </>
  );
}
