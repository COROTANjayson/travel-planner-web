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
    <nav
      className="itinerary-days [position:sticky] [top:var(--app-top)] [z-index:30] [min-width:0] [padding-block:0.75rem] [background:var(--background)] max-md:[&]:[padding-block:0.25rem_0.75rem] md:[&]:[top:calc(var(--app-top)_+_0.5rem)] lg:[&]:[top:1rem] lg:[&]:[padding-block:0]"
      aria-label="Choose itinerary day"
    >
      <div
        className="day-rail [&]:[position:relative] [&]:[display:flex] [&]:[gap:0.5rem] [&]:[overflow-x:auto] [&]:[overscroll-behavior-x:contain] [&]:[scroll-snap-type:x_proximity] [&]:[padding:0.25rem] [&]:[scrollbar-width:thin] [&]:[scrollbar-color:var(--input)_transparent] max-md:[&]:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:[display:none] md:[&]:[gap:0.75rem] lg:[&]:[flex-direction:column] lg:[&]:[max-height:calc(100dvh_-_5rem)] lg:[&]:[overflow-y:auto]"
        ref={dayRail}
      >
        {dates.map((date) => {
          const count = (activitiesQuery.data ?? []).filter(
            (activity) =>
              localDate(activity.starts_at, trip.time_zone) === date,
          ).length;
          return (
            <button
              key={date}
              type="button"
              className="itinerary-day [flex:0_0_5.5rem] [display:flex] [flex-direction:column] [align-items:flex-start] [gap:0.125rem] [min-width:0] [border:1px_solid_var(--border)] [border-radius:1rem] [background:var(--background)] [color:var(--muted-foreground)] [padding:0.625rem] [scroll-snap-align:start] [cursor:pointer] [text-align:left] [transition:background-color_150ms_ease-out] [&[aria-current='date']]:[background:var(--ocean)] [&[aria-current='date']]:[color:white] [&[aria-current='date']]:[border-color:var(--ocean)] [&:focus-visible]:[outline:2px_solid_var(--ring)] [&:focus-visible]:[outline-offset:2px] [&:active]:[background:var(--secondary)] [&:active]:[color:var(--foreground)] max-lg:[&]:[align-items:center] max-lg:[&]:[text-align:center] md:[&]:[flex-basis:5.5rem] md:[&]:[padding:0.75rem] lg:[&]:[flex:none] lg:[&]:[display:grid] lg:[&]:[grid-template-columns:2rem_minmax(0,_1fr)] lg:[&]:[column-gap:0.75rem] [@media(hover:hover)_and_(pointer:fine)]:[&:not([aria-current]):hover]:bg-accent"
              aria-current={date === selected ? "date" : undefined}
              aria-label={`${dateLabel(date)}${date === today ? ", Today" : ""}`}
              onClick={() => setSelected(date)}
            >
              <span className="day-weekday [white-space:nowrap] [&]:[font-size:0.6875rem] [&]:[line-height:1.5] lg:[&]:[grid-column:2]">
                {new Intl.DateTimeFormat(undefined, {
                  weekday: "short",
                  timeZone: "UTC",
                }).format(new Date(`${date}T12:00:00Z`))}
                {date === today && " · Today"}
              </span>
              <span className="day-number [font-size:1.5rem] [line-height:1.3] [font-weight:600] lg:[&]:[grid-column:1] lg:[&]:[grid-row:1_/_span_2] lg:[&]:[align-self:center]">
                {Number(date.slice(-2))}
              </span>
              <span className="day-plan [&]:[font-size:0.6875rem] [&]:[line-height:1.5] lg:[&]:[grid-column:2]">
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
