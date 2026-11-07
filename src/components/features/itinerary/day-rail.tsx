"use client";

import type { RefObject } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { dateLabel, localDate } from "@/lib/activity-time";
import type { Activity } from "@/lib/itinerary";
import type { Trip } from "@/lib/trips";

export function DayRail({
  trip,
  dates,
  selected,
  today,
  setSelected,
  activitiesQuery,
  dayRail,
}: {
  trip: Trip;
  dates: string[];
  selected: string;
  today: string;
  setSelected: (date: string) => void;
  activitiesQuery: UseQueryResult<Activity[]>;
  dayRail: RefObject<HTMLDivElement | null>;
}) {
  return (
    <nav className="itinerary-days" aria-label="Choose itinerary day">
      <div className="day-rail" ref={dayRail}>
        {dates.map((date) => {
          const count = (activitiesQuery.data ?? []).filter(
            (activity) =>
              localDate(activity.starts_at, trip.time_zone) === date,
          ).length;
          return (
            <button
              key={date}
              type="button"
              className="itinerary-day"
              aria-current={date === selected ? "date" : undefined}
              aria-label={`${dateLabel(date)}${date === today ? ", Today" : ""}`}
              onClick={() => setSelected(date)}
            >
              <span className="day-weekday">
                {new Intl.DateTimeFormat(undefined, {
                  weekday: "short",
                  timeZone: "UTC",
                }).format(new Date(`${date}T12:00:00Z`))}
                {date === today && " · Today"}
              </span>
              <span className="day-number">{Number(date.slice(-2))}</span>
              <span className="day-plan">
                {activitiesQuery.isSuccess
                  ? count
                    ? `${count} planned`
                    : "Open day"
                  : activitiesQuery.isPending
                    ? "Loading…"
                    : "Unavailable"}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
