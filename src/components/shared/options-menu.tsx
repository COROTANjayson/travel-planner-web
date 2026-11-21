"use client";

import { useState, type ReactNode } from "react";
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
  destructive?: boolean;
  disabled?: boolean;
};

/**
 * The ⋯ menu: a popover from md up, and on phones a bottom sheet titled with
 * `name` (and `description`) whose rows are big enough to tap.
 */
export function OptionsMenu({
  name,
  description,
  disabled,
  items,
}: {
  name: string;
  description?: string;
  disabled?: boolean;
  items: Item[];
}) {
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const rows = (phone: boolean) =>
    items.map((item) => (
      <Button
        key={item.label}
        variant="ghost"
        disabled={disabled || item.disabled}
        // Corners nest in the popover (12px radius - 4px padding). Focus shows as the
        // hover highlight, not the thick ring, since opening the menu focuses the first item.
        className={`min-h-11 w-full justify-start gap-3 rounded-sm px-3 whitespace-normal text-left focus-visible:border-transparent focus-visible:ring-0 [&_svg:not([class*='size-'])]:size-[18px] ${phone ? "text-base font-normal" : ""} ${item.destructive ? "text-destructive hover:bg-destructive/10 hover:text-destructive focus-visible:bg-destructive/10" : "focus-visible:bg-accent focus-visible:text-accent-foreground"}`}
        onClick={() => {
          setOpen(false);
          setSheet(false);
          item.onClick();
        }}
      >
        {item.icon ? (
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
            <Button
              variant="ghost"
              className="size-11 min-h-11 shrink-0"
              aria-label={`More options for ${name}`}
            />
          }
        >
          <DotsThreeIcon aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-56 max-w-[calc(100vw-3rem)] gap-0 p-1"
        >
          <PopoverTitle className="sr-only">Options for {name}</PopoverTitle>
          {rows(false)}
        </PopoverContent>
      </Popover>
      {sheet && (
        <TripDialog
          open
          onOpenChange={setSheet}
          title={name}
          description={description}
          mobilePresentation="sheet"
          bodyClassName="space-y-1 px-3 pt-0"
        >
          {rows(true)}
        </TripDialog>
      )}
    </>
  );
}
