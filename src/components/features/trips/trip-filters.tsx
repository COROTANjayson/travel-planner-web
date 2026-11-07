"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { tripStatus, type Trip, type TripStatus } from "@/lib/trips";

export type Status = "All" | TripStatus;

export function TripFilters({
  trips,
  status,
  setStatus,
  setOffset,
}: {
  trips: UseQueryResult<Trip[]>;
  status: Status;
  setStatus: (status: Status) => void;
  setOffset: (offset: number) => void;
}) {
  return (
    <nav aria-label="Filter trips" className="trip-filters">
      {(["All", "Ongoing", "Upcoming", "Past"] as const).map((option) => (
        <Button
          key={option}
          type="button"
          className="trip-filter"
          variant="ghost"
          aria-pressed={status === option}
          onClick={() => {
            setStatus(option);
            setOffset(0);
          }}
        >
          {option}
          {trips.isSuccess && (
            <span className="filter-count">
              {option === "All"
                ? trips.data.length
                : trips.data.filter(
                    (trip) =>
                      tripStatus(
                        trip.start_date,
                        trip.end_date,
                        trip.time_zone,
                      ) === option,
                  ).length}
            </span>
          )}
        </Button>
      ))}
    </nav>
  );
}
