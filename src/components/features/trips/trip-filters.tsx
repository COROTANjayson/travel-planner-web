"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { tripStatus, type Trip, type TripStatus } from "@/lib/trips";

export const filterNavClass =
  "flex gap-0.5 overflow-x-auto rounded-full bg-muted p-1";
export const filterButtonClass =
  "min-h-11 flex-1 gap-1 rounded-full border-0 p-2.5 text-xs text-muted-foreground hover:bg-[#dbe7e0] hover:text-foreground aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-[#0b5d61] aria-pressed:hover:text-white focus-visible:ring-0 focus-visible:outline-2 focus-visible:-outline-offset-3 focus-visible:outline-ring active:not-focus-visible:scale-100";
export const filterCountClass =
  "inline-flex min-w-5 items-center justify-center rounded-full text-xs leading-5 tabular-nums";

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
    <nav
      aria-label="Filter trips"
      className={cn(
        filterNavClass,
        "col-span-full lg:col-span-1 lg:w-fit lg:max-w-full",
      )}
    >
      {(["All", "Ongoing", "Upcoming", "Past"] as const).map((option) => (
        <Button
          key={option}
          type="button"
          className={cn(
            filterButtonClass,
            "md:gap-2 md:px-4 [@media(width<360px)]:px-2 [@media(width<360px)]:text-[0.6875rem]",
          )}
          variant="ghost"
          aria-pressed={status === option}
          onClick={() => {
            setStatus(option);
            setOffset(0);
          }}
        >
          {option}
          {trips.isSuccess && (
            <span className={filterCountClass}>
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
