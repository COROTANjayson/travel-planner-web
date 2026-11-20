"use client";

import { useEffect, type ReactNode, type RefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import { ActivityCard } from "@/components/features/itinerary/activity-card";
import { TripError } from "@/components/shared/trip-states";
import { dateLabel, localDate, timeLabel } from "@/lib/activity-time";
import { ApiError } from "@/lib/api";
import type { Activity } from "@/lib/itinerary";
import { prepKey, usePrepApi } from "@/lib/prep";
import type { Trip } from "@/lib/trips";

export function ActivityTimeline({
  trip,
  selected,
  selectedActivities,
  emptyAction,
  onFailure,
  currentUserID,
  viewing,
  setViewing,
  detailTriggerRef,
}: {
  trip: Trip;
  selected: string;
  selectedActivities: Activity[];
  emptyAction?: ReactNode;
  onFailure: (error: Error) => void | Promise<void>;
  currentUserID?: number;
  viewing: number | null;
  setViewing: (id: number | null) => void;
  detailTriggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const prepApi = usePrepApi(trip.id, onFailure);
  const prep = useQuery({
    queryKey: prepKey(trip.id),
    queryFn: ({ signal }) => prepApi.list(signal),
    enabled: selectedActivities.length > 0,
    retry: false,
  });
  const accessError =
    prep.error instanceof ApiError && [403, 404].includes(prep.error.status)
      ? prep.error
      : null;
  useEffect(() => {
    if (accessError) void onFailure(accessError);
  }, [accessError, onFailure]);

  return (
    <div
      aria-label="Trip dates"
      className="itinerary-board pb-3 [&_.day-column]:[width:100%] [&_.day-column]:[min-width:0]"
    >
      {[selected].map((date) => {
        const dayActivities = selectedActivities;
        return (
          <section
            key={date}
            data-date={date}
            aria-label={dateLabel(date)}
            className="day-column"
          >
            <div
              id={`day-${date}-details`}
              role="region"
              aria-labelledby={`day-${date}-heading`}
              className="space-y-3"
            >
              {dayActivities.length > 0 &&
                prep.isError &&
                !prep.data &&
                !accessError && (
                  <TripError
                    title="Couldn’t load prep tasks"
                    error={prep.error}
                    retry={() => void prep.refetch()}
                    pending={prep.isFetching}
                  />
                )}
              {dayActivities.length === 0 ? (
                <div className="day-empty flex flex-col items-start gap-3 rounded-xl border bg-card p-4">
                  <div className="space-y-1">
                    <p className="text-base leading-[1.375rem] font-semibold">
                      Nothing planned yet
                    </p>
                    <p className="text-sm leading-5 text-muted-foreground">
                      {emptyAction
                        ? "Add your first activity to start planning this day."
                        : "Activities will appear here when an editor adds them."}
                    </p>
                  </div>
                  {emptyAction}
                </div>
              ) : (
                <ul className="grid gap-4">
                  {dayActivities.map((activity) => {
                    return (
                      <li
                        key={activity.id}
                        className="timeline-entry grid grid-cols-[3.5rem_minmax(0,1fr)] items-stretch gap-2 md:before:pointer-events-none md:after:pointer-events-none max-md:grid-cols-[minmax(0,1fr)] md:relative md:grid-cols-[var(--time-rail)_minmax(0,1fr)] md:gap-8 md:[--time-rail:4.5rem] md:before:absolute md:before:top-6 md:before:left-[calc(var(--time-rail)+0.25rem)] md:before:z-1 md:before:size-2 md:before:rounded-full md:before:bg-[#6c9185] md:before:content-[''] md:after:absolute md:after:top-7 md:after:-bottom-11 md:last:after:hidden md:after:left-[calc(var(--time-rail)+0.5rem)] md:after:border-l md:after:border-border md:after:content-[''] [&_.activity-category]:min-w-0 [&_button[data-selected]]:outline-2 [&_button[data-selected]]:-outline-offset-2 [&_button[data-selected]]:outline-ring [&_[data-slot='card']]:border [&_[data-slot='card']]:border-border [&_[data-slot='card']]:py-4 [&_[data-slot='card']]:shadow-none [&_[data-slot='card']]:transition-[border-color] [@media(hover:hover)_and_(pointer:fine)]:[&_[data-slot='card']:has(button:hover)]:border-input [@media(hover:hover)_and_(pointer:fine)]:[&_button:hover]:bg-[color-mix(in_srgb,var(--trip-sea)_40%,transparent)]"
                      >
                        <p className="timeline-time [position:relative] [padding-top:0.75rem] [font-size:0.75rem] [line-height:1rem] [font-variant-numeric:tabular-nums] [color:var(--foreground)] max-md:[&]:[padding-top:0] md:[&]:[font-size:0.875rem] md:[&]:[line-height:1.25rem] md:[&]:[padding-top:1.25rem]">
                          <time dateTime={activity.starts_at}>
                            {timeLabel(activity.starts_at, trip.time_zone)}
                          </time>{" "}
                          <span className="timeline-time-end md:[&]:[display:block] md:leading-4 md:[&]:[font-size:0.75rem] md:[&]:[color:var(--muted-foreground)]">
                            <span className="md:sr-only">– </span>
                            <time dateTime={activity.ends_at}>
                              {timeLabel(activity.ends_at, trip.time_zone)}
                            </time>
                          </span>
                          {localDate(activity.ends_at, trip.time_zone) >
                            date && (
                            <span className="timeline-end-date [color:var(--muted-foreground)] md:[&]:[display:block] md:[&]:[font-size:0.75rem]">
                              {" "}
                              · ends{" "}
                              {dateLabel(
                                localDate(activity.ends_at, trip.time_zone),
                              )}
                            </span>
                          )}
                        </p>
                        <ActivityCard
                          activity={activity}
                          prepTasks={prep.data?.filter(
                            (task) => task.activity?.id === activity.id,
                          )}
                          currentUserID={currentUserID}
                          viewing={viewing}
                          setViewing={setViewing}
                          detailTriggerRef={detailTriggerRef}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
