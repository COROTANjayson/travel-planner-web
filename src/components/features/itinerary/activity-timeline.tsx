"use client";

import type { RefObject } from "react";
import { ActivityCard } from "@/components/features/itinerary/activity-card";
import { dateLabel, localDate, timeLabel } from "@/lib/activity-time";
import type { Activity } from "@/lib/itinerary";
import type { Trip } from "@/lib/trips";

export function ActivityTimeline({
  trip,
  selected,
  selectedActivities,
  canEdit,
  viewing,
  setViewing,
  detailTriggerRef,
}: {
  trip: Trip;
  selected: string;
  selectedActivities: Activity[];
  canEdit: boolean;
  viewing: number | null;
  setViewing: (id: number | null) => void;
  detailTriggerRef: RefObject<HTMLButtonElement | null>;
}) {
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
              {dayActivities.length === 0 ? (
                <div className="day-empty [padding:1rem] [border:1px_solid_var(--border)] [border-radius:1rem] [background:var(--card)]">
                  <p className="font-semibold">Nothing planned yet</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {canEdit
                      ? "Add your first activity to start planning this day."
                      : "Activities will appear here when an editor adds them."}
                  </p>
                </div>
              ) : (
                <ul className="space-y-4">
                  {dayActivities.map((activity) => {
                    return (
                      <li
                        key={activity.id}
                        className="timeline-entry grid grid-cols-[3.5rem_minmax(0,1fr)] items-stretch gap-2 before:pointer-events-none after:pointer-events-none max-md:grid-cols-[minmax(0,1fr)] md:relative md:grid-cols-[var(--time-rail)_minmax(0,1fr)] md:gap-4 md:[--time-rail:4.5rem] md:before:absolute md:before:top-6 md:before:left-[calc(var(--time-rail)+0.25rem)] md:before:z-1 md:before:size-2 md:before:rounded-full md:before:bg-[#6c9185] md:before:content-[''] md:after:absolute md:after:top-7 md:after:bottom-[-1.5rem] md:after:left-[calc(var(--time-rail)+0.5rem)] md:after:border-l md:after:border-border md:after:content-[''] [&_.activity-category]:min-w-0 [&_.activity-category]:rounded-lg [&_[data-slot='card-content']]:px-4 [&_button[data-selected]]:outline-2 [&_button[data-selected]]:-outline-offset-2 [&_button[data-selected]]:outline-ring [&_[data-slot='card']]:rounded-2xl [&_[data-slot='card']]:border [&_[data-slot='card']]:border-border [&_[data-slot='card']]:py-4 [&_[data-slot='card']]:shadow-none [&_[data-slot='card']]:transition-[border-color] md:[&_.activity-category]:text-[0.6875rem] md:[&_.activity-category]:leading-4 md:[&_[data-slot='card-content']]:px-5 md:[&_[data-slot='card']]:min-h-32 md:[&_[data-slot='card']]:py-5 [@media(hover:hover)_and_(pointer:fine)]:[&_[data-slot='card']:has(button:hover)]:border-input [@media(hover:hover)_and_(pointer:fine)]:[&_button:hover]:bg-[color-mix(in_srgb,var(--trip-sea)_40%,transparent)]"
                      >
                        <p className="timeline-time [position:relative] [padding-top:0.75rem] [font-size:0.75rem] [line-height:1.25rem] [font-variant-numeric:tabular-nums] [color:var(--foreground)] max-md:[&]:[padding-top:0] md:[&]:[font-size:0.875rem] md:[&]:[padding-top:1.25rem]">
                          <time dateTime={activity.starts_at}>
                            {timeLabel(activity.starts_at, trip.time_zone)}
                          </time>{" "}
                          <span className="timeline-time-end md:[&]:[display:block] md:[&]:[font-size:0.75rem] md:[&]:[color:var(--muted-foreground)]">
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
