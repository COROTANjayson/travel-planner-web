"use client";

import type { ReactNode, RefObject } from "react";
import { SlidersHorizontalIcon } from "@phosphor-icons/react";
import { TripDialog } from "@/components/shared/trip-dialog";
import { Button } from "@/components/ui/button";

export function DayOptionsDialog({
  dayOptionsOpen,
  setDayOptionsOpen,
  mapOpen,
  conflictsOpen,
  dayOptionsTrigger,
  dayTools,
}: {
  dayOptionsOpen: boolean;
  setDayOptionsOpen: (open: boolean) => void;
  mapOpen: boolean;
  conflictsOpen: boolean;
  dayOptionsTrigger: RefObject<HTMLButtonElement | null>;
  dayTools: ReactNode;
}) {
  return (
    <TripDialog
      title="Day options"
      itineraryStyle
      mobilePresentation="sheet"
      open={dayOptionsOpen}
      onOpenChange={setDayOptionsOpen}
      finalFocus={() =>
        mapOpen || conflictsOpen ? false : dayOptionsTrigger.current
      }
      trigger={
        <Button
          variant="ghost"
          className="size-11 min-h-11 p-0"
          ref={dayOptionsTrigger}
          aria-label="Day options"
        >
          <SlidersHorizontalIcon aria-hidden="true" className="size-5" />
        </Button>
      }
    >
      <div className="mobile-day-options [&_nav]:[flex-direction:column] [&_nav]:[gap:0.25rem] [&_[data-slot='button']]:[min-height:48px] [&_[data-slot='button']]:[justify-content:flex-start] [&_[data-slot='button']]:rounded-xl [&_[data-slot='button']]:gap-3 [&_[data-slot='button']]:px-3 [&_[data-slot='button']]:text-base [&_[data-slot='button']]:font-normal [&_svg]:size-5">
        {dayTools}
      </div>
    </TripDialog>
  );
}
