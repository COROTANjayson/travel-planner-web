"use client";

import { CalendarDays, Clock3, MapPin } from "lucide-react";
import { formatActivityTime } from "@/lib/activity-time";
import {
  formatTripDates,
  tripDayCount,
  tripStatus,
  type Trip,
} from "@/lib/trips";

export function TripSummary({ trip }: { trip: Trip }) {
  return (
    <div className="trip-summary">
      <div className="trip-summary-destination">
        <p className="flex min-w-0 items-start gap-2 text-sm text-muted-foreground">
          <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 break-words">{trip.destination}</span>
        </p>
        <span
          className="trip-status"
          data-status={tripStatus(
            trip.start_date,
            trip.end_date,
            trip.time_zone,
          )}
        >
          {tripStatus(trip.start_date, trip.end_date, trip.time_zone)}
        </span>
      </div>
      <h1 className="trip-summary-title">{trip.name}</h1>
      <div className="trip-summary-meta">
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
