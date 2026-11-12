"use client";

import { CalendarDays, Clock3, MapPin } from "lucide-react";
import { formatActivityTime } from "@/lib/activity-time";
import { cn } from "@/lib/utils";
import {
  formatTripDates,
  tripDayCount,
  tripStatus,
  type Trip,
} from "@/lib/trips";

export function TripSummary({ trip }: { trip: Trip }) {
  const status = tripStatus(trip.start_date, trip.end_date, trip.time_zone);
  return (
    <div className="trip-summary relative isolate overflow-hidden rounded-3xl bg-[var(--trip-sea)] p-4 before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-[url('/coastal/journey.svg')] before:bg-[position:right_center] before:bg-[length:auto_100%] before:bg-no-repeat before:opacity-20 before:content-[''] md:px-8 md:py-6">
      <div className="trip-summary-destination [display:flex] [align-items:flex-start] [justify-content:space-between] [gap:0.75rem]">
        <p className="flex min-w-0 items-start gap-2 text-sm text-muted-foreground">
          <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 break-words">{trip.destination}</span>
        </p>
        <span
          className={cn(
            "inline-flex w-fit items-center rounded-full bg-muted px-3 py-1 text-xs leading-5 font-semibold whitespace-nowrap text-muted-foreground",
            status === "Upcoming" && "bg-secondary text-primary",
            status === "Ongoing" && "bg-[#1c6465] text-white",
          )}
        >
          {status}
        </span>
      </div>
      <h1 className="trip-summary-title [margin-block:1rem_1.5rem] [font-size:1.75rem] [line-height:1.25] [font-weight:600] [letter-spacing:-0.025em] max-md:[&]:[margin-block:0.5rem_0.75rem] md:[&]:[margin-block:0.5rem_0.75rem]">
        {trip.name}
      </h1>
      <div className="trip-summary-meta [display:flex] [flex-wrap:wrap] [gap:0.75rem_1.5rem] [font-size:0.8125rem] [line-height:1.5] [color:var(--muted-foreground)] max-md:[&]:[gap:0.375rem_1rem]">
        <p className="flex items-start gap-2">
          <CalendarDays aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{formatTripDates(trip.start_date, trip.end_date)}</span>
        </p>
        <p>
          {tripDayCount(trip.start_date, trip.end_date)}{" "}
          {tripDayCount(trip.start_date, trip.end_date) === 1 ? "day" : "days"}
        </p>
        <p className="flex min-w-0 items-start gap-2">
          <Clock3 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span className="break-words">{trip.time_zone}</span>
        </p>
        {trip.starts_at && trip.ends_at && (
          <p>
            <time dateTime={trip.starts_at}>
              {formatActivityTime(trip.starts_at, trip.time_zone)}
            </time>{" "}
            &ndash;{" "}
            <time dateTime={trip.ends_at}>
              {formatActivityTime(trip.ends_at, trip.time_zone)}
            </time>
          </p>
        )}
      </div>
    </div>
  );
}
