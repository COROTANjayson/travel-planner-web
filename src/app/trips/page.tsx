"use client";



import Image from "next/image";

import Link from "next/link";

import { useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { CalendarDays, ChevronRight, Compass, MapPin, Plus } from "lucide-react";

import { formatTripDates, orderTrips, tripStatus, tripPageSize, useTripsApi, type Trip, type TripStatus } from "@/lib/trips";

import { Button } from "@/components/ui/button";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { TripError, TripLoading } from "@/components/trips/trip-states";



type Status = "All" | TripStatus;



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

      <div className="flex flex-wrap items-center justify-between gap-4">

        <div className="min-w-0 space-y-3"><p className="eyebrow">Your travel journal</p><h1 className="journal-title text-balance">Somewhere worth going.</h1><p className="text-muted-foreground">A few days away. A collection of good memories.</p></div>

        <Button className="journey-accent min-h-12" render={<Link href="/trips/new" />} nativeButton={false}><Plus aria-hidden="true" />New trip</Button>

      </div>

      <nav aria-label="Filter trips" className="flex gap-1 overflow-x-auto border-b pb-3">

        {(["All", "Ongoing", "Upcoming", "Past"] as const).map((option) => <Button key={option} type="button" className={`min-h-12 shrink-0 rounded-xl border-0 px-5 ${status === option ? "bg-secondary text-secondary-foreground hover:bg-secondary" : "text-muted-foreground"}`} variant="ghost"

          aria-pressed={status === option} onClick={() => { setStatus(option); setOffset(0); }}>{option}</Button>)}

      </nav>

      {trips.isPending ? <TripLoading /> : trips.isError ? (

        <TripError error={trips.error} retry={() => void trips.refetch()} pending={trips.isFetching} />

      ) : visible.length === 0 ? (

        <Card className="items-center py-10 text-center md:py-16">

          <CardHeader>

            <Compass aria-hidden="true" className="mx-auto mb-4 size-12 rounded-2xl bg-secondary p-3" />
            <CardTitle>{status === "All" ? "No trips yet" : `No ${status.toLowerCase()} trips`}</CardTitle>

            <CardDescription>{status === "All" ? "Create a trip to get started." : "Choose another filter to see your trips."}</CardDescription>

          </CardHeader>

          {status === "All" && <CardContent>

            <p className="text-sm text-muted-foreground">Choose a destination and dates. Build your itinerary one day at a time.</p>
            <Button className="journey-accent mt-6" render={<Link href="/trips/new" />} nativeButton={false}><Plus aria-hidden="true" />Plan your first trip</Button>

          </CardContent>}

        </Card>

      ) : (

        <div className="grid gap-6 lg:grid-cols-2">

          {visible.map((trip, index) => (

            <Card key={trip.id} className={`journey-trip ${index === 0 ? "featured" : ""}`}>

              <div className="journey-cover"><picture><source media="(max-width: 1023px)" srcSet="/illustrations/journey-cover-mobile.svg" /><Image src="/illustrations/journey-cover.svg" alt="" width={772} height={380} /></picture></div>

              <div className="journey-trip-copy flex min-w-0 flex-1 flex-col justify-center gap-4">

                <div className="flex flex-wrap items-center justify-between gap-3"><p className="eyebrow">{String(offset + index + 1).padStart(2, "0")} / Your journey</p><span className="trip-status" data-status={tripStatus(trip.start_date, trip.end_date, trip.time_zone)}>{tripStatus(trip.start_date, trip.end_date, trip.time_zone)}</span></div>

                <h2 className="journey-trip-title break-words font-heading text-2xl leading-tight tracking-tight">{trip.name}</h2>

                <div className="space-y-2 text-sm text-muted-foreground"><p className="flex items-start gap-2"><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span className="min-w-0 break-words">{trip.destination}</span></p><p className="flex items-start gap-2"><CalendarDays aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span>{formatTripDates(trip.start_date, trip.end_date)}</span></p></div>

                <p className="break-words text-xs text-muted-foreground">{trip.time_zone}</p>

                <Button className="mt-2 min-h-12 w-full justify-between lg:w-fit lg:min-w-48" render={<Link href={`/trips/${trip.id}`} />} nativeButton={false}>Open itinerary <ChevronRight aria-hidden="true" /></Button>

              </div>

            </Card>

          ))}

        </div>

      )}

      {filtered.length > tripPageSize && <nav aria-label="Trip pages" className="flex flex-wrap items-center justify-between gap-3">

        <Button variant="outline" className="min-h-11" disabled={offset === 0 || trips.isFetching}

          onClick={() => setOffset((current) => Math.max(0, current - tripPageSize))}>Previous</Button>

        <span className="text-sm text-muted-foreground">Page {offset / tripPageSize + 1}</span>

        <Button variant="outline" className="min-h-11"

          disabled={trips.isFetching || trips.isError || offset + tripPageSize >= filtered.length}

          onClick={() => setOffset((current) => current + tripPageSize)}>Next</Button>

      </nav>}

    </>

  );

}
