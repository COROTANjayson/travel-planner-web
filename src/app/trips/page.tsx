"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronRight,
  Compass,
  MapPin,
  Plus,
} from "lucide-react";
import {
  formatTripDates,
  tripDayCount,
  orderTrips,
  tripStatus,
  tripPageSize,
  useTripsApi,
  type Trip,
  type TripStatus,
} from "@/lib/trips";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TripError, TripLoading } from "@/components/trips/trip-states";

type Status = "All" | TripStatus;

export default function TripsPage() {
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<Status>("All");
  const tripsApi = useTripsApi();
  const trips = useQuery({
    queryKey: ["trips", "all"],
    queryFn: async ({ signal }) => {
      // shortcut: load all trip pages for client sorting; move filtering to the API if trip counts make this slow.
      const all: Trip[] = [];
      for (let page = 0; ; page += 100) {
        const batch = await tripsApi.list(100, page, signal);
        all.push(...batch);
        if (batch.length < 100) return all;
      }
    },
    retry: false,
  });
  const filtered = trips.data
    ? orderTrips(trips.data).filter(
        (trip) =>
          status === "All" ||
          tripStatus(trip.start_date, trip.end_date, trip.time_zone) === status,
      )
    : [];
  const visible = filtered.slice(offset, offset + tripPageSize);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 md:space-y-6">
      <div className="trips-heading flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-2">
          <h1 className="page-title">Your trips</h1>
          <p className="text-muted-foreground">
            All your plans, ready when you are.
          </p>
        </div>
        <Button
          className="min-h-12 w-full sm:w-auto"
          render={<Link href="/trips/new" />}
          nativeButton={false}
        >
          <Plus aria-hidden="true" />
          New trip
        </Button>
      </div>
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
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {trips.isSuccess
          ? `${filtered.length} ${status === "All" ? "trips" : `${status.toLowerCase()} trips`}`
          : ""}
      </p>
      {trips.isPending ? (
        <TripLoading />
      ) : trips.isError ? (
        <TripError
          error={trips.error}
          retry={() => void trips.refetch()}
          pending={trips.isFetching}
        />
      ) : visible.length === 0 ? (
        <Card className="trips-empty">
          <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-3 text-center">
            <Compass
              aria-hidden="true"
              className="mb-2 size-14 rounded-full bg-secondary p-4 text-primary"
            />
            <h2 className="text-xl font-semibold">
              {status === "All"
                ? "No trips yet"
                : `No ${status.toLowerCase()} trips`}
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              {status === "All"
                ? "Choose a destination and dates. Build your itinerary one day at a time."
                : "Choose another filter to see your trips."}
            </p>
            {status === "All" ? (
              <Button
                className="mt-3 max-w-full whitespace-normal"
                render={<Link href="/trips/new" />}
                nativeButton={false}
              >
                <Plus aria-hidden="true" />
                Plan your first trip
              </Button>
            ) : (
              <Button
                className="mt-3 max-w-full whitespace-normal"
                variant="outline"
                onClick={() => {
                  setStatus("All");
                  setOffset(0);
                }}
              >
                Show all trips
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="trip-grid grid gap-5 lg:grid-cols-2">
          {visible.map((trip) => (
            <Link
              key={trip.id}
              href={`/trips/${trip.id}`}
              className="trip-card min-w-0"
              aria-labelledby={`trip-${trip.id}-name`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <h2
                    id={`trip-${trip.id}-name`}
                    className="trip-card-title min-w-0 break-words"
                  >
                    {trip.name}
                  </h2>
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
                <p className="flex min-w-0 items-start gap-2 text-sm text-muted-foreground">
                  <MapPin
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0"
                  />
                  <span className="min-w-0 break-words">
                    {trip.destination}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CalendarDays
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0"
                  />
                  <span>{formatTripDates(trip.start_date, trip.end_date)}</span>
                </p>
                <span className="text-xs text-muted-foreground">
                  {tripDayCount(trip.start_date, trip.end_date)}{" "}
                  {tripDayCount(trip.start_date, trip.end_date) === 1
                    ? "day"
                    : "days"}
                </span>
              </div>
              <div className="mt-auto flex items-center justify-between gap-4 border-t pt-3">
                <p className="min-w-0 flex-1 break-words text-xs text-muted-foreground">
                  Time zone: {trip.time_zone}
                </p>
                <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
                  View trip{" "}
                  <ChevronRight aria-hidden="true" className="size-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
      {filtered.length > tripPageSize && (
        <nav
          aria-label="Trip pages"
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <Button
            variant="outline"
            className="min-h-11"
            disabled={offset === 0 || trips.isFetching}
            onClick={() =>
              setOffset((current) => Math.max(0, current - tripPageSize))
            }
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {offset / tripPageSize + 1}
          </span>
          <Button
            variant="outline"
            className="min-h-11"
            disabled={
              trips.isFetching ||
              trips.isError ||
              offset + tripPageSize >= filtered.length
            }
            onClick={() => setOffset((current) => current + tripPageSize)}
          >
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}
