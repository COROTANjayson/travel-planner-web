"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";
import { validTripID } from "@/lib/trips";
import { TripDetail } from "@/components/features/trips/trip-detail";
import { TripLoading, TripNotFound } from "@/components/shared/trip-states";

export default function TripPage() {
  const { tripID } = useParams<{ tripID: string }>();
  const id = validTripID(tripID);
  return id === null ? (
    <TripNotFound />
  ) : (
    <Suspense fallback={<TripLoading />}>
      <TripDetail key={id} id={id} />
    </Suspense>
  );
}
