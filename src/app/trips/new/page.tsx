"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTripsApi } from "@/lib/trips";
import { Button } from "@/components/ui/button";
import { TripForm } from "@/components/features/trips/trip-form";
import { CompassIcon, XIcon } from "@phosphor-icons/react";

export default function NewTripPage() {
  const api = useTripsApi();
  const queryClient = useQueryClient();
  const router = useRouter();
  const create = useMutation({
    mutationFn: api.create,
    onSuccess: async (trip) => {
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
      router.push(`/trips/${trip.id}`);
    },
  });

  return (
    <section className="new-trip mx-auto w-full max-w-[40rem] space-y-7 md:rounded-[28px] md:border md:bg-card md:p-10 lg:mt-8">
      <div className="sticky top-0 z-20 -mx-5 flex items-center gap-1 bg-background px-3 pt-[env(safe-area-inset-top,0px)] md:hidden">
        <Button
          variant="ghost"
          className="size-11"
          aria-label="Close new trip"
          render={<Link href="/trips" />}
          nativeButton={false}
          disabled={create.isPending}
        >
          <XIcon aria-hidden="true" />
        </Button>
        <span className="font-semibold">New trip</span>
      </div>
      <div className="space-y-3">
        <span className="grid size-12 place-items-center rounded-full bg-secondary text-primary">
          <CompassIcon className="size-[22px]" aria-hidden="true" />
        </span>
        <h1 className="page-title text-3xl font-[650] leading-[1.2] tracking-[-0.03em] text-balance md:[&]:[font-size:2.25rem]">
          Where to next?
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Pick a place and your dates. We’ll set up your days.
        </p>
      </div>
      <TripForm
        creating
        onSubmit={(input) => create.mutate(input)}
        pending={create.isPending}
        error={create.error}
        submitLabel="Create trip"
        cancel={
          <Button
            className="min-h-12 rounded-full"
            variant="ghost"
            disabled={create.isPending}
            render={<Link href="/trips" />}
            nativeButton={false}
          >
            Cancel
          </Button>
        }
      />
    </section>
  );
}
