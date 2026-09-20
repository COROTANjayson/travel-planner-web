"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { tripPageSize, useTripsApi } from "@/lib/trips";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TripError, TripLoading } from "@/components/trips/trip-states";

export default function TripsPage() {
  const [offset, setOffset] = useState(0);
  const tripsApi = useTripsApi();
  const trips = useQuery({
    queryKey: ["trips", tripPageSize, offset],
    queryFn: ({ signal }) => tripsApi.list(tripPageSize, offset, signal),
    retry: false,
  });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Trips</h1>
        <Button className="min-h-11" render={<Link href="/trips/new" />} nativeButton={false}>Create trip</Button>
      </div>
      {trips.isPending ? <TripLoading /> : trips.isError ? (
        <TripError error={trips.error} retry={() => void trips.refetch()} pending={trips.isFetching} />
      ) : trips.data.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{offset === 0 ? "No trips yet" : "No more trips"}</CardTitle>
            <CardDescription>{offset === 0 ? "Create a trip to get started." : "Go back to see your earlier trips."}</CardDescription>
          </CardHeader>
          {offset === 0 && <CardContent>
            <Button className="min-h-11" render={<Link href="/trips/new" />} nativeButton={false}>Create your first trip</Button>
          </CardContent>}
        </Card>
      ) : (
        <div className="space-y-4">
          {trips.data.map((trip) => (
            <Card key={trip.id}>
              <CardHeader>
                <CardTitle>
                  <Link href={`/trips/${trip.id}`} className="inline-flex min-h-11 items-center break-all underline-offset-4 hover:underline">
                    {trip.name}
                  </Link>
                </CardTitle>
                <CardDescription className="break-words">{trip.destination}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 text-muted-foreground">
                <p><time dateTime={trip.start_date}>{trip.start_date}</time> – <time dateTime={trip.end_date}>{trip.end_date}</time></p>
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
          disabled={trips.isFetching || trips.isError || !trips.data || trips.data.length < tripPageSize}
          onClick={() => setOffset((current) => current + tripPageSize)}>Next</Button>
      </nav>
    </>
  );
}

