"use client";

import { CalendarDotsIcon, ClockIcon, MapPinIcon } from "@phosphor-icons/react";
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
    <div className="trip-summary relative isolate overflow-hidden flex flex-col gap-2.5 rounded-2xl bg-[var(--trip-sea)] p-4 before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-[url('/coastal/journey.svg')] before:bg-[position:right_center] before:bg-[length:auto_100%] before:bg-no-repeat before:opacity-20 before:content-[''] md:px-8 md:py-6">
      <div className="trip-summary-destination [display:flex] [align-items:flex-start] [justify-content:space-between] [gap:0.75rem]">
        <p className="flex min-w-0 items-start gap-2 text-sm leading-5 text-muted-foreground">
          <MapPinIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
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
      <h1 className="trip-summary-title text-[1.75rem] leading-[2.1875rem] font-semibold tracking-[-0.025em]">
        {trip.name}
      </h1>
      <div className="trip-summary-meta [display:flex] [flex-wrap:wrap] items-center gap-x-4 gap-y-1.5 text-[0.8125rem] leading-5 text-muted-foreground md:gap-x-6">
        <p className="flex items-start gap-2">
          <CalendarDotsIcon
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          <span>{formatTripDates(trip.start_date, trip.end_date)}</span>
        </p>
        <p>
          {tripDayCount(trip.start_date, trip.end_date)}{" "}
          {tripDayCount(trip.start_date, trip.end_date) === 1 ? "day" : "days"}
        </p>
        <p className="flex min-w-0 items-start gap-2">
          <ClockIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
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
