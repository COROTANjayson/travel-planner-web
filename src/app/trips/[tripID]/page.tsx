"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, type ApiUser, useApi } from "@/lib/api";
import { permissions, useMembershipsApi } from "@/lib/memberships";
import { Invitations, Participants } from "@/components/trips/memberships";
import { Itinerary } from "@/components/trips/itinerary";
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
  const request = useApi();
  const memberships = useMembershipsApi(id);
  const me = useQuery({ queryKey: ["me"], queryFn: () => request<ApiUser>("/api/v1/me"), retry: false });
  const members = useQuery({ queryKey: ["trip", id, "members"], queryFn: ({ signal }) => memberships.members(signal), retry: false });
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const [accessError, setAccessError] = useState<Error | null>(null);
  const current = me.isSuccess && members.isSuccess && !permissionBlocked ? members.data.find((person) => person.user_id === me.data?.id) : undefined;
  const allowed = permissions(current?.role);
  const handleFailure = useCallback((error: Error) => {
    if (!(error instanceof ApiError)) return;
    if (error.status === 404) setAccessError(error);
    if (error.status === 403 || error.status === 409) {
      setAccessError(error);
      setPermissionBlocked(true);
      return queryClient.refetchQueries({ queryKey: ["trip", id, "members"] }).then(() => {
        if (queryClient.getQueryState(["trip", id, "members"])?.status === "success") setPermissionBlocked(false);
      });
    }
  }, [id, queryClient]);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const trip = useQuery({
    queryKey: ["trip", id],
    queryFn: ({ signal }) => api.get(id, signal),
    retry: false,
  });
  const update = useMutation({
    onError: handleFailure,
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
    onError: handleFailure,
    mutationFn: () => api.remove(id),
    onSuccess: async () => {
      await queryClient.cancelQueries({ queryKey: ["trip", id] });
      queryClient.removeQueries({ queryKey: ["trip", id] });
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
      router.replace("/trips");
    },
  });

  if ([trip.error, members.error, accessError, update.error, remove.error].some((error) => error instanceof ApiError && error.status === 404)) {
    return <TripNotFound />;
  }
  if (trip.isPending) return <TripLoading />;
  if (trip.isError) return <TripError error={trip.error} retry={() => void trip.refetch()} pending={trip.isFetching} />;

  return (
    <>
      <Button className="min-h-11" variant="outline" render={<Link href="/trips" />} nativeButton={false}>Back to trips</Button>
      {accessError && <TripError error={accessError} />}
      {editing && allowed.edit ? (
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
            {allowed.edit && <Button className="min-h-11" onClick={() => { update.reset(); setEditing(true); }}>Edit trip</Button>}
            {allowed.manage && <AlertDialog open={confirming} onOpenChange={(open) => {
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
            </AlertDialog>}
          </div>
        </>
      )}
      {me.isError && <TripError error={me.error} retry={() => void me.refetch()} pending={me.isFetching} />}
      <Itinerary trip={trip.data} participants={members.data} canEdit={allowed.edit} onFailure={handleFailure} />
      {members.isPending ? <p role="status">Loading participants…</p> : members.isError ?
        <TripError error={members.error} retry={() => void members.refetch().then((result) => { if (result.isSuccess) setPermissionBlocked(false); })} pending={members.isFetching} /> :
        <Participants id={id} participants={members.data} current={current} onFailure={handleFailure} />}
      {allowed.manage && <Invitations id={id} onFailure={handleFailure} />}
    </>
  );
}
