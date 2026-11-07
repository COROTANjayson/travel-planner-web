"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight, MapPin } from "lucide-react";
import {
  formatTripDates,
  tripDayCount,
  tripStatus,
  type Trip,
} from "@/lib/trips";

export function TripCard({
  trip,
  featuredID,
}: {
  trip: Trip;
  featuredID?: number;
}) {
  return (
    <Link
      href={`/trips/${trip.id}`}
      className="trip-card min-w-0"
      data-featured={trip.id === featuredID || undefined}
      data-status={tripStatus(trip.start_date, trip.end_date, trip.time_zone)}
      data-tone={
        tripStatus(trip.start_date, trip.end_date, trip.time_zone) === "Ongoing"
          ? "sea"
          : trip.id % 2 === 0
            ? "sand"
            : "mist"
      }
      aria-labelledby={`trip-${trip.id}-name`}
    >
      <div className="trip-card-content">
        <div className="trip-card-top">
          <MapPin aria-hidden="true" className="size-4" />
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
        <p className="trip-card-destination">{trip.destination}</p>
        <h2 id={`trip-${trip.id}-name`} className="trip-card-title">
          {trip.name}
        </h2>
      </div>
      <div className="trip-card-bottom">
        <div className="min-w-0">
          <p className="trip-card-dates">
            <CalendarDays
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            <span>
              {formatTripDates(trip.start_date, trip.end_date)} ·{" "}
              {tripDayCount(trip.start_date, trip.end_date)}{" "}
              {tripDayCount(trip.start_date, trip.end_date) === 1
                ? "day"
                : "days"}
            </span>
          </p>
          <p className="trip-card-zone">Time zone: {trip.time_zone}</p>
        </div>
        <span className="trip-open">
          <span className="sr-only">View trip</span>
          <ChevronRight aria-hidden="true" />
        </span>
      </div>
      {trip.id === featuredID && (
        <div className="trip-date-pass" aria-hidden="true">
          {(trip.start_date === trip.end_date
            ? [trip.start_date]
            : [trip.start_date, trip.end_date]
          ).map((date, index) => (
            <span key={index}>
              <b>{Number(date.slice(-2))}</b>
              {new Intl.DateTimeFormat(undefined, {
                month: "short",
                timeZone: "UTC",
              }).format(new Date(`${date}T12:00:00Z`))}
            </span>
          ))}
          <small>
            {tripDayCount(trip.start_date, trip.end_date)}{" "}
            {tripDayCount(trip.start_date, trip.end_date) === 1
              ? "day"
              : "days"}{" "}
            to make your own
          </small>
        </div>
      )}
    </Link>
  );
}
