"use client";

import type { ReactNode, RefObject } from "react";
import { SlidersHorizontal } from "lucide-react";
import { TripDialog } from "@/components/shared/trip-dialog";
import { Button } from "@/components/ui/button";
import { dateLabel } from "@/lib/activity-time";

export function DayOptionsDialog({
  selected,
  dayOptionsOpen,
  setDayOptionsOpen,
  mapOpen,
  conflictsOpen,
  dayOptionsTrigger,
  dayTools,
}: {
  selected: string;
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
      description={dateLabel(selected)}
      mobilePresentation="sheet"
      open={dayOptionsOpen}
      onOpenChange={setDayOptionsOpen}
      finalFocus={() =>
        mapOpen || conflictsOpen ? false : dayOptionsTrigger.current
      }
      trigger={
        <Button
          variant="ghost"
          className="size-11"
          ref={dayOptionsTrigger}
          aria-label="Day options"
        >
          <SlidersHorizontal aria-hidden="true" />
        </Button>
      }
    >
      <div className="mobile-day-options">{dayTools}</div>
    </TripDialog>
  );
}
