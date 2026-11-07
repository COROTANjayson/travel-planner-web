"use client";

import type { ComponentProps } from "react";
import dynamic from "next/dynamic";
import type { UseQueryResult } from "@tanstack/react-query";
import { TripDialog } from "@/components/shared/trip-dialog";
import { TripError } from "@/components/shared/trip-states";
import { dateLabel, localDate } from "@/lib/activity-time";
import type { Activity } from "@/lib/itinerary";
import type { Trip } from "@/lib/trips";

const TripMap = dynamic(
  () => import("@/components/features/itinerary/trip-map"),
  {
    ssr: false,
    loading: () => <p role="status">Loading map…</p>,
  },
);

export function DayMapDialog({
  trip,
  selected,
  mapOpen,
  setMapOpen,
  finalFocus,
  activitiesQuery,
}: {
  trip: Trip;
  selected: string;
  mapOpen: boolean;
  setMapOpen: (open: boolean) => void;
  finalFocus: ComponentProps<typeof TripDialog>["finalFocus"];
  activitiesQuery: UseQueryResult<Activity[]>;
}) {
  return (
    <TripDialog
      title={`Places on ${dateLabel(selected)}`}
      description="Places attached to activities on the selected day."
      open={mapOpen}
      onOpenChange={setMapOpen}
      finalFocus={finalFocus}
    >
      {activitiesQuery.isPending ? (
        <p role="status">Loading places...</p>
      ) : activitiesQuery.isError ? (
        <TripError
          error={activitiesQuery.error}
          retry={() => void activitiesQuery.refetch()}
        />
      ) : (
        <TripMap
          activities={activitiesQuery.data.filter(
            (activity) =>
              localDate(activity.starts_at, trip.time_zone) === selected,
          )}
        />
      )}
    </TripDialog>
  );
}
