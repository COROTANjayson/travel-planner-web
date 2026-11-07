"use client";

import type { RefObject } from "react";
import { CalendarCheck, CalendarDays, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dateLabel } from "@/lib/activity-time";
import type { Trip } from "@/lib/trips";

export function DayTools({
  trip,
  selected,
  today,
  setSelected,
  dayOptionsOpen,
  setDayOptionsOpen,
  setMapOpen,
  setConflictsOpen,
  conflictsFailed,
  dayConflictCount,
  dayToolTriggerRef,
  dayOptionsTriggerRef,
}: {
  trip: Trip;
  selected: string;
  today: string;
  setSelected: (date: string) => void;
  dayOptionsOpen: boolean;
  setDayOptionsOpen: (open: boolean) => void;
  setMapOpen: (open: boolean) => void;
  setConflictsOpen: (open: boolean) => void;
  conflictsFailed: boolean;
  dayConflictCount: number;
  dayToolTriggerRef: RefObject<HTMLButtonElement | null>;
  dayOptionsTriggerRef: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <nav
      aria-label={`Tools for ${dateLabel(selected)}`}
      className="flex flex-wrap gap-1"
    >
      {today >= trip.start_date &&
        today <= trip.end_date &&
        selected !== today && (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 px-2"
            onClick={() => {
              setDayOptionsOpen(false);
              setSelected(today);
            }}
          >
            <CalendarDays aria-hidden="true" />
            Today
          </Button>
        )}
      <Button
        variant="ghost"
        className="min-h-11 px-2"
        onClick={(event) => {
          dayToolTriggerRef.current = dayOptionsOpen
            ? dayOptionsTriggerRef.current
            : event.currentTarget;
          setDayOptionsOpen(false);
          setMapOpen(true);
        }}
      >
        <MapPin aria-hidden="true" />
        View map
      </Button>
      {(conflictsFailed || dayConflictCount > 0) && (
        <Button
          variant="ghost"
          className="day-tool-overlaps min-h-11 px-2"
          onClick={(event) => {
            dayToolTriggerRef.current = dayOptionsOpen
              ? dayOptionsTriggerRef.current
              : event.currentTarget;
            setDayOptionsOpen(false);
            setConflictsOpen(true);
          }}
        >
          <CalendarCheck aria-hidden="true" />
          Overlaps
          <span className="rounded-full px-2 py-0.5 text-xs">
            {conflictsFailed ? "Unavailable" : dayConflictCount}
          </span>
        </Button>
      )}
    </nav>
  );
}
