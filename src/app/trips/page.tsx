"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Temporal } from "@js-temporal/polyfill";
import { tripPageSize, useTripsApi, type Trip } from "@/lib/trips";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TripError, TripLoading } from "@/components/trips/trip-states";

const readableDate = (date: string) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

function tripStatus(start: string, end: string, zone: string): Exclude<Status, "All"> {
  const today = Temporal.Now.zonedDateTimeISO(zone).toPlainDate().toString();
  return today < start ? "Upcoming" : today > end ? "Past" : "Ongoing";
}

type Status = "All" | "Ongoing" | "Upcoming" | "Past";
const statusOrder: Record<Exclude<Status, "All">, number> = { Ongoing: 0, Upcoming: 1, Past: 2 };

export function orderTrips(items: Trip[]) {
  return [...items].sort((a, b) => {
    const aStatus = tripStatus(a.start_date, a.end_date, a.time_zone);
    const bStatus = tripStatus(b.start_date, b.end_date, b.time_zone);
    const group = statusOrder[aStatus] - statusOrder[bStatus];
    if (group) return group;
    const dateOrder = aStatus === "Past" ? b.end_date.localeCompare(a.end_date) :
      aStatus === "Upcoming" ? a.start_date.localeCompare(b.start_date) : a.end_date.localeCompare(b.end_date);
    return dateOrder || b.id - a.id;
  });
}

export default function TripsPage() {
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<Status>("All");
  const tripsApi = useTripsApi();
  const trips = useQuery({
    queryKey: ["trips", "all"],
    queryFn: async ({ signal }) => {
      // ponytail: load all trip pages for client sorting; move filtering to the API if trip counts make this slow.
      const all: Trip[] = [];
      for (let page = 0;; page += 100) {
        const batch = await tripsApi.list(100, page, signal);
        all.push(...batch);
        if (batch.length < 100) return all;
      }
    },
    retry: false,
  });
  const filtered = trips.data ? orderTrips(trips.data).filter((trip) => status === "All" || tripStatus(trip.start_date, trip.end_date, trip.time_zone) === status) : [];
  const visible = filtered.slice(offset, offset + tripPageSize);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Trips</h1>
        <Button className="min-h-11" render={<Link href="/trips/new" />} nativeButton={false}>Create trip</Button>
      </div>
      <nav aria-label="Filter trips" className="flex gap-2 overflow-x-auto pb-1">
        {(["All", "Ongoing", "Upcoming", "Past"] as const).map((option) => <Button key={option} type="button" className="min-h-11 shrink-0" variant={status === option ? "default" : "outline"}
          aria-pressed={status === option} onClick={() => { setStatus(option); setOffset(0); }}>{option}</Button>)}
      </nav>
      {trips.isPending ? <TripLoading /> : trips.isError ? (
        <TripError error={trips.error} retry={() => void trips.refetch()} pending={trips.isFetching} />
      ) : visible.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{status === "All" ? "No trips yet" : `No ${status.toLowerCase()} trips`}</CardTitle>
            <CardDescription>{status === "All" ? "Create a trip to get started." : "Choose another filter to see your trips."}</CardDescription>
          </CardHeader>
          {status === "All" && <CardContent>
            <Button className="min-h-11" render={<Link href="/trips/new" />} nativeButton={false}>Create your first trip</Button>
          </CardContent>}
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((trip) => (
            <Card key={trip.id} className="relative gap-2 py-4 transition-shadow hover:shadow-sm focus-within:ring-2 focus-within:ring-ring">
              <CardHeader className="gap-1 px-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tripStatus(trip.start_date, trip.end_date, trip.time_zone)}</p>
                <CardTitle>
                  <Link href={`/trips/${trip.id}`} className="inline-flex min-h-11 items-center break-words underline-offset-4 after:absolute after:inset-0 after:rounded-xl focus:outline-none hover:underline">
                    {trip.name}
                  </Link>
                </CardTitle>
                <CardDescription className="break-words">{trip.destination}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 px-4 text-sm text-muted-foreground">
                <p><time dateTime={trip.start_date}>{readableDate(trip.start_date)}</time> – <time dateTime={trip.end_date}>{readableDate(trip.end_date)}</time></p>
                <p className="break-words">{trip.time_zone}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <nav aria-label="Trip pages" className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" className="min-h-11" disabled={offset === 0 || trips.isFetching}
          onClick={() => setOffset((current) => Math.max(0, current - tripPageSize))}>Previous</Button>
        <span className="text-sm text-muted-foreground">Page {offset / tripPageSize + 1}</span>
        <Button variant="outline" className="min-h-11"
          disabled={trips.isFetching || trips.isError || offset + tripPageSize >= filtered.length}
          onClick={() => setOffset((current) => current + tripPageSize)}>Next</Button>
      </nav>
    </>
  );
}
