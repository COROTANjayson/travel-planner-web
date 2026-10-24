"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTripsApi } from "@/lib/trips";
import { Button } from "@/components/ui/button";
import { TripForm } from "@/components/trips/trip-form";

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
    <section className="form-surface space-y-6">
      <div className="form-heading space-y-3">
        <h1 className="page-title">Where to next?</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Choose a destination and dates. Your daily itinerary comes next.
        </p>
      </div>
      <TripForm
        onSubmit={(input) => create.mutate(input)}
        pending={create.isPending}
        error={create.error}
        submitLabel="Create trip"
        cancel={
          <Button
            className="min-h-11"
            variant="outline"
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
