"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { type TripInput, useTripsApi, validTripID } from "@/lib/trips";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { TripForm } from "@/components/trips/trip-form";
import { TripError, TripLoading, TripNotFound } from "@/components/trips/trip-states";

export default function TripPage() {
  const { tripID } = useParams<{ tripID: string }>();
  const id = validTripID(tripID);
  return id === null ? <TripNotFound /> : <TripDetail key={id} id={id} />;
}

function TripDetail({ id }: { id: number }) {
  const api = useTripsApi();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const trip = useQuery({
    queryKey: ["trip", id],
    queryFn: ({ signal }) => api.get(id, signal),
    retry: false,
  });
  const update = useMutation({
    mutationFn: (input: TripInput) => api.update(id, input),
    onSuccess: async (saved) => {
      queryClient.setQueryData(["trip", id], saved);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["trips"] }),
        queryClient.invalidateQueries({ queryKey: ["trip", id], exact: true }),
      ]);
      setEditing(false);
    },
  });
  const remove = useMutation({
    mutationFn: () => api.remove(id),
    onSuccess: async () => {
      await queryClient.cancelQueries({ queryKey: ["trip", id], exact: true });
      queryClient.removeQueries({ queryKey: ["trip", id], exact: true });
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
      router.replace("/trips");
    },
  });

  if ([trip.error, update.error, remove.error].some((error) => error instanceof ApiError && error.status === 404)) {
    return <TripNotFound />;
  }
  if (trip.isPending) return <TripLoading />;
  if (trip.isError) return <TripError error={trip.error} retry={() => void trip.refetch()} pending={trip.isFetching} />;

  return (
    <>
      <Button className="min-h-11" variant="outline" render={<Link href="/trips" />} nativeButton={false}>Back to trips</Button>
      {editing ? (
        <>
          <h1 className="text-2xl font-semibold">Edit trip</h1>
          <TripForm initialValue={trip.data} onSubmit={(input) => update.mutate(input)}
            pending={update.isPending} error={update.error} submitLabel="Save changes"
            cancel={<Button type="button" className="min-h-11" variant="outline" disabled={update.isPending}
              onClick={() => { update.reset(); setEditing(false); }}>Cancel</Button>} />
        </>
      ) : (
        <>
          <h1 className="break-words text-2xl font-semibold">{trip.data.name}</h1>
          <Card>
            <CardContent>
              <dl className="space-y-4">
                <div><dt className="text-muted-foreground">Destination</dt><dd className="break-words">{trip.data.destination}</dd></div>
                <div><dt className="text-muted-foreground">Dates</dt><dd><time dateTime={trip.data.start_date}>{trip.data.start_date}</time> – <time dateTime={trip.data.end_date}>{trip.data.end_date}</time></dd></div>
                <div><dt className="text-muted-foreground">Time zone</dt><dd className="break-words">{trip.data.time_zone}</dd></div>
              </dl>
            </CardContent>
          </Card>
          <div className="flex flex-wrap gap-3">
            <Button className="min-h-11" onClick={() => { update.reset(); setEditing(true); }}>Edit trip</Button>
            <AlertDialog open={confirming} onOpenChange={(open) => {
              if (!remove.isPending) { setConfirming(open); remove.reset(); }
            }}>
              <AlertDialogTrigger render={<Button className="min-h-11" variant="destructive" />}>Delete trip</AlertDialogTrigger>
              <AlertDialogContent className="w-[calc(100%-2rem)]">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this trip?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes the trip and all its activities. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {remove.error && <TripError error={remove.error} />}
                <AlertDialogFooter>
                  <AlertDialogCancel className="min-h-11" disabled={remove.isPending}>Cancel</AlertDialogCancel>
                  <AlertDialogAction className="min-h-11" variant="destructive" disabled={remove.isPending}
                    onClick={() => { if (!remove.isPending) remove.mutate(); }}>
                    {remove.isPending ? "Deleting…" : "Delete trip"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </>
      )}
    </>
  );
}

