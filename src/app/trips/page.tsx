"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronRight,
  Compass,
  MapPin,
  Plus,
  Search,
  Briefcase,
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
import { Input } from "@/components/ui/input";

type Status = "All" | TripStatus;

export default function TripsPage() {
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<Status>("All");
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
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
          (status === "All" ||
            tripStatus(trip.start_date, trip.end_date, trip.time_zone) ===
              status) &&
          `${trip.name} ${trip.destination}`
            .toLocaleLowerCase()
            .includes(search.trim().toLocaleLowerCase()),
      )
    : [];
  const visible = filtered.slice(offset, offset + tripPageSize);
  const featuredID = filtered.find(
    (trip) =>
      tripStatus(trip.start_date, trip.end_date, trip.time_zone) === "Ongoing",
  )?.id;
  const noTrips = trips.data?.length === 0;

  function resetFilters() {
    setStatus("All");
    setSearch("");
    setOffset(0);
    searchRef.current?.focus();
  }

  return (
    <div className="trips-overview">
      <div className="trips-context">
        <Briefcase aria-hidden="true" />
        My trips
      </div>
      <div className="trips-heading">
        <div className="min-w-0 space-y-2">
          <h1 className="page-title">Your trips</h1>
          <p className="text-muted-foreground">
            A little planning. A lot to look forward to.
          </p>
        </div>
        <Button
          className="trips-create"
          aria-label="Create a trip"
          render={<Link href="/trips/new" />}
          nativeButton={false}
        >
          <Plus aria-hidden="true" />
          <span>Create a trip</span>
        </Button>
        <label className="trips-search">
          <Search aria-hidden="true" />
          <Input
            ref={searchRef}
            type="search"
            aria-label="Find a trip or destination"
            placeholder="Find a trip or destination"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setOffset(0);
            }}
          />
        </label>
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
      <p className="trips-order">
        <CalendarDays aria-hidden="true" />
        Ongoing first, then upcoming
      </p>
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {trips.isSuccess
          ? `${filtered.length} ${status === "All" ? "" : `${status.toLowerCase()} `}${filtered.length === 1 ? "trip" : "trips"}`
          : ""}
      </p>
      {trips.isPending ? (
        <TripLoading overview />
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
              {noTrips
                ? "No trips yet"
                : search.trim()
                  ? "No trips found"
                  : `No ${status.toLowerCase()} trips`}
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              {noTrips
                ? "Choose a destination and dates. Build your itinerary one day at a time."
                : "Try another search or show all your trips."}
            </p>
            {noTrips ? (
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
                onClick={resetFilters}
              >
                Show all trips
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="trip-grid">
          {visible.map((trip) => (
            <Link
              key={trip.id}
              href={`/trips/${trip.id}`}
              className="trip-card min-w-0"
              data-featured={trip.id === featuredID || undefined}
              data-status={tripStatus(
                trip.start_date,
                trip.end_date,
                trip.time_zone,
              )}
              data-tone={
                tripStatus(trip.start_date, trip.end_date, trip.time_zone) ===
                "Ongoing"
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
          ))}
        </div>
      )}
      {trips.isSuccess && filtered.length > 0 && (
        <p className="trips-results">
          {filtered.length} {filtered.length === 1 ? "trip" : "trips"}, many
          possibilities.
        </p>
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
