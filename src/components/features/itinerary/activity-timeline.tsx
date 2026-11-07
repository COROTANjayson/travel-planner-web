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
    <div aria-label="Trip dates" className="itinerary-board pb-3">
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
                <div className="day-empty">
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
                      <li key={activity.id} className="timeline-entry">
                        <p className="timeline-time">
                          <time dateTime={activity.starts_at}>
                            {timeLabel(activity.starts_at, trip.time_zone)}
                          </time>{" "}
                          <span className="timeline-time-end">
                            <span className="md:sr-only">– </span>
                            <time dateTime={activity.ends_at}>
                              {timeLabel(activity.ends_at, trip.time_zone)}
                            </time>
                          </span>
                          {localDate(activity.ends_at, trip.time_zone) >
                            date && (
                            <span className="timeline-end-date">
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
