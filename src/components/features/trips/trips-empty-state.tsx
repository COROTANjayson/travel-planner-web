"use client";

import Link from "next/link";
import { Compass, Plus } from "lucide-react";
import type { Status } from "@/components/features/trips/trip-filters";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function TripsEmptyState({
  noTrips,
  search,
  status,
  resetFilters,
}: {
  noTrips: boolean;
  search: string;
  status: Status;
  resetFilters: () => void;
}) {
  return (
    <Card className="rounded-2xl border border-border px-6 py-12 shadow-none md:py-16">
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
  );
}
