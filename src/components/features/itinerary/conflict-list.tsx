"use client";

import { useEffect } from "react";
import { useQueries } from "@tanstack/react-query";
import { TripError } from "@/components/shared/trip-states";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { formatActivityTime, localDate } from "@/lib/activity-time";
import {
  type Activity,
  type ActivityConflict,
  useItineraryApi,
} from "@/lib/itinerary";
import type { Trip } from "@/lib/trips";

export function ConflictList({
  trip,
  conflicts,
  loaded,
  onUnavailable,
  onViewDay,
  onEdit,
}: {
  trip: Trip;
  conflicts: ActivityConflict[];
  loaded: Activity[];
  onUnavailable: () => Promise<void>;
  onViewDay: (date: string) => void;
  onEdit?: (activity: Activity) => void;
}) {
  const api = useItineraryApi(trip.id, () => {});
  const missingIDs = Array.from(
    new Set(conflicts.flatMap((conflict) => conflict.activity_ids)),
  ).filter((id) => !loaded.some((activity) => activity.id === id));
  const details = useQueries({
    queries: missingIDs.map((id) => ({
      queryKey: ["trip", trip.id, "activity", id],
      queryFn: ({ signal }: { signal: AbortSignal }) => api.get(id, signal),
      retry: false,
    })),
  });
  const missing = details.some(
    (query) => query.error instanceof ApiError && query.error.status === 404,
  );
  useEffect(() => {
    if (missing) void onUnavailable();
  }, [missing, onUnavailable]);
  function activityFor(id: number) {
    const known = loaded.find((activity) => activity.id === id);
    if (known) return known;
    const detail = details[missingIDs.indexOf(id)];
    return detail?.data;
  }
  function title(id: number) {
    const activity = activityFor(id);
    if (activity) return activity.title;
    const detail = details[missingIDs.indexOf(id)];
    return detail?.isError ? "Activity unavailable" : "Loading activity…";
  }
  const failure = details.find(
    (query) =>
      query.isError &&
      !(query.error instanceof ApiError && query.error.status === 404),
  );
  return (
    <>
      {missing && (
        <p role="status">
          An activity is unavailable. Refreshing the schedule…
        </p>
      )}
      {failure && (
        <TripError
          error={failure.error}
          retry={() => {
            details
              .filter((query) => query.isError)
              .forEach((query) => void query.refetch());
          }}
        />
      )}
      <ul className="space-y-4">
        {conflicts.map((conflict) => (
          <li
            key={conflict.activity_ids.join("-")}
            className="space-y-2 border-b pb-4 last:border-0 last:pb-0"
          >
            <p className="break-words font-medium">
              {title(conflict.activity_ids[0])} and{" "}
              {title(conflict.activity_ids[1])}
            </p>
            <p className="text-sm">
              <time dateTime={conflict.overlap_starts_at}>
                {formatActivityTime(conflict.overlap_starts_at, trip.time_zone)}
              </time>{" "}
              –{" "}
              <time dateTime={conflict.overlap_ends_at}>
                {formatActivityTime(conflict.overlap_ends_at, trip.time_zone)}
              </time>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() =>
                  onViewDay(
                    localDate(conflict.overlap_starts_at, trip.time_zone),
                  )
                }
              >
                View day
              </Button>
              {onEdit &&
                conflict.activity_ids.map((id) => (
                  <Button
                    key={id}
                    type="button"
                    variant="ghost"
                    className="min-h-11"
                    disabled={!activityFor(id)}
                    onClick={() => {
                      const activity = activityFor(id);
                      if (activity) onEdit(activity);
                    }}
                  >
                    Edit {title(id)}
                  </Button>
                ))}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
