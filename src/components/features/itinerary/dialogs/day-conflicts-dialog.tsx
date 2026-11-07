"use client";

import type { ComponentProps } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { ConflictList } from "@/components/features/itinerary/conflict-list";
import { TripDialog } from "@/components/shared/trip-dialog";
import { TripError } from "@/components/shared/trip-states";
import { dateLabel } from "@/lib/activity-time";
import type { Activity, ActivityConflict } from "@/lib/itinerary";
import type { Trip } from "@/lib/trips";

export function DayConflictsDialog({
  trip,
  selected,
  conflictsOpen,
  setConflictsOpen,
  finalFocus,
  conflictsQuery,
  dayConflicts,
  loaded,
  onUnavailable,
  onViewDay,
  onEdit,
}: {
  trip: Trip;
  selected: string;
  conflictsOpen: boolean;
  setConflictsOpen: (open: boolean) => void;
  finalFocus: ComponentProps<typeof TripDialog>["finalFocus"];
  conflictsQuery: UseQueryResult<ActivityConflict[]>;
  dayConflicts: ActivityConflict[];
  loaded: Activity[];
  onUnavailable: () => Promise<void>;
  onViewDay: (date: string) => void;
  onEdit?: (activity: Activity) => void;
}) {
  return (
    <TripDialog
      title={`Conflicts on ${dateLabel(selected)}`}
      description="Overlapping activities on this day."
      open={conflictsOpen}
      onOpenChange={setConflictsOpen}
      finalFocus={finalFocus}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Overlaps are advisory. Parallel activities are allowed. Overlap times
          below use {trip.time_zone}.
        </p>
        {conflictsQuery.isPending ? (
          <p role="status">Loading conflicts…</p>
        ) : conflictsQuery.isError ? (
          <TripError
            error={conflictsQuery.error}
            retry={() => void conflictsQuery.refetch()}
            pending={conflictsQuery.isFetching}
          />
        ) : (
          <>
            {dayConflicts.length === 0 ? (
              <p className="text-muted-foreground">
                No schedule conflicts on this day.
              </p>
            ) : (
              <ConflictList
                trip={trip}
                conflicts={dayConflicts}
                loaded={loaded}
                onUnavailable={onUnavailable}
                onViewDay={onViewDay}
                onEdit={onEdit}
              />
            )}
          </>
        )}
      </div>
    </TripDialog>
  );
}
