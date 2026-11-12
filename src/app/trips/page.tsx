"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Plus, Search, Briefcase } from "lucide-react";
import {
  orderTrips,
  tripStatus,
  tripPageSize,
  useTripsApi,
  type Trip,
} from "@/lib/trips";
import { Button } from "@/components/ui/button";
import { TripError, TripLoading } from "@/components/shared/trip-states";
import { TripCard } from "@/components/features/trips/trip-card";
import {
  TripFilters,
  type Status,
} from "@/components/features/trips/trip-filters";
import { TripPagination } from "@/components/features/trips/trip-pagination";
import { TripsEmptyState } from "@/components/features/trips/trips-empty-state";
import { Input } from "@/components/ui/input";

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
    <div className="trips-overview grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-6 lg:gap-6 [@media(width<360px)]:gap-x-0 [@media(width<360px)]:gap-y-5 [&>:not(nav,[data-order])]:col-span-full">
      <div className="hidden items-center lg:flex gap-2 text-sm text-muted-foreground">
        <Briefcase aria-hidden="true" className="size-4" />
        My trips
      </div>
      <div className="col-span-full mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-5 lg:mb-3 lg:gap-8">
        <div className="min-w-0 space-y-2">
          <h1 className="page-title !text-[clamp(2rem,3.2vw,3rem)] font-[650] leading-[1.2] tracking-[-0.03em] text-balance md:[&]:[font-size:2.25rem]">
            Your trips
          </h1>
          <p className="text-sm text-muted-foreground">
            A little planning. A lot to look forward to.
          </p>
        </div>
        <Button
          className="min-h-11 min-w-11 rounded-full p-3 md:px-5 lg:hidden"
          aria-label="Create a trip"
          render={<Link href="/trips/new" />}
          nativeButton={false}
        >
          <Plus aria-hidden="true" className="size-5" />
          <span className="hidden md:inline">Create a trip</span>
        </Button>
        <label className="relative col-span-full flex items-center md:max-w-96 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:w-[clamp(15rem,24vw,24rem)]">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-4 size-4 text-muted-foreground"
          />
          <Input
            className="rounded-full bg-background pl-11 [&::-webkit-search-cancel-button]:cursor-pointer"
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
      <TripFilters
        trips={trips}
        status={status}
        setStatus={setStatus}
        setOffset={setOffset}
      />
      <p
        data-order
        className="hidden items-center justify-self-end gap-2 text-xs text-muted-foreground lg:flex"
      >
        <CalendarDays aria-hidden="true" className="size-3.5" />
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
        <TripsEmptyState
          noTrips={noTrips}
          search={search}
          status={status}
          resetFilters={resetFilters}
        />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2 [&>:only-child]:col-span-full [&>:only-child]:w-full [&>:only-child]:max-w-none">
          {visible.map((trip) => (
            <TripCard key={trip.id} trip={trip} featuredID={featuredID} />
          ))}
        </div>
      )}
      {trips.isSuccess && filtered.length > 0 && (
        <p className="m-0 text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "trip" : "trips"}, many
          possibilities.
        </p>
      )}
      {filtered.length > tripPageSize && (
        <TripPagination
          offset={offset}
          setOffset={setOffset}
          isFetching={trips.isFetching}
          isError={trips.isError}
          filteredCount={filtered.length}
        />
      )}
    </div>
  );
}
