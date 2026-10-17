"use client";



import Image from "next/image";

import Link from "next/link";

import { useParams, useRouter } from "next/navigation";

import { useCallback, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, type ApiUser, useApi } from "@/lib/api";

import { permissions, useMembershipsApi } from "@/lib/memberships";

import { Invitations, Participants } from "@/components/trips/memberships";

import { Itinerary } from "@/components/trips/itinerary";

import { formatTripDates, type TripInput, useTripsApi, validTripID } from "@/lib/trips";

import { formatActivityTime } from "@/lib/activity-time";

import { Button } from "@/components/ui/button";

import { Settings2, Users, ArrowLeft, MoreHorizontal } from "lucide-react";

import { TripDialog } from "@/components/trips/trip-dialog";

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

  const [peopleOpen, setPeopleOpen] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);

  const [saveMessage, setSaveMessage] = useState("");

  const [confirming, setConfirming] = useState(false);

  const trip = useQuery({

    queryKey: ["trip", id],

    queryFn: ({ signal }) => api.get(id, signal),

    retry: false,

  });

  const update = useMutation({

    onError: (error: Error) => { if (!(error instanceof ApiError && error.status === 409)) handleFailure(error); },

    mutationFn: (input: TripInput) => api.update(id, input),

    onSuccess: async (saved) => {

      queryClient.setQueryData(["trip", id], saved);

      await Promise.all([

        queryClient.invalidateQueries({ queryKey: ["trips"] }),

        queryClient.invalidateQueries({ queryKey: ["trip", id], exact: true }),

        queryClient.invalidateQueries({ queryKey: ["trip", id, "activities"] }),

      ]);

      setEditing(false);

      setSaveMessage("Trip settings saved.");

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



  return <>

    <div className="mobile-trip-header fixed inset-x-0 top-0 z-40 flex items-center gap-2 border-b bg-background px-3 md:hidden">

      <Button variant="ghost" className="size-12 shrink-0" aria-label="Back to trips" render={<Link href="/trips" />} nativeButton={false}><ArrowLeft aria-hidden="true" /></Button>

      <span className="min-w-0 flex-1 truncate font-semibold">{trip.data.name}</span>

      <TripDialog title="Trip options" description={trip.data.name} mobilePresentation="sheet" open={menuOpen} onOpenChange={setMenuOpen} finalFocus={() => peopleOpen || editing ? false : document.querySelector<HTMLButtonElement>("[aria-label=\"Trip options\"]")}

        trigger={<Button variant="ghost" className="size-12 shrink-0" aria-label="Trip options"><MoreHorizontal aria-hidden="true" /></Button>}>

        <div className="space-y-2">

          <Button variant="ghost" className="w-full justify-start" onClick={() => { setMenuOpen(false); setPeopleOpen(true); }}><Users aria-hidden="true" />People {members.data?.length ?? ""}</Button>

          {allowed.edit && <Button variant="ghost" className="w-full justify-start" onClick={() => { setMenuOpen(false); setEditing(true); }}><Settings2 aria-hidden="true" />Settings</Button>}

        </div>

      </TripDialog>

    </div>

    <Button className="hidden min-h-11 -ml-3 md:inline-flex" variant="ghost" render={<Link href="/trips" />} nativeButton={false}><ArrowLeft aria-hidden="true" />Back to trips</Button>

    <p role="status" aria-live="polite" className="sr-only">{saveMessage}</p>

    {accessError && <TripError error={accessError} />}

    {me.isError && <TripError error={me.error} retry={() => void me.refetch()} pending={me.isFetching} />}

    <Itinerary trip={trip.data} participants={members.data} canEdit={allowed.edit} onFailure={handleFailure}

      header={<div className="journey-heading"><div className="min-w-0 space-y-2">

        <h1 className="page-title break-words">{trip.data.name}</h1>

        <p className="break-words text-sm text-muted-foreground">{trip.data.destination}</p>

        <p className="text-sm font-medium">{formatTripDates(trip.data.start_date, trip.data.end_date)}</p>

        {trip.data.starts_at && trip.data.ends_at && <details className="text-sm text-muted-foreground md:hidden">

          <summary className="flex min-h-11 cursor-pointer items-center">Trip details</summary>

          <div className="space-y-2 pb-2">        <p className="text-sm text-muted-foreground">{trip.data.starts_at && trip.data.ends_at ? <><time dateTime={trip.data.starts_at}>{formatActivityTime(trip.data.starts_at, trip.data.time_zone)}</time> – <time dateTime={trip.data.ends_at}>{formatActivityTime(trip.data.ends_at, trip.data.time_zone)}</time></> : <><time dateTime={trip.data.start_date}>{trip.data.start_date}</time> – <time dateTime={trip.data.end_date}>{trip.data.end_date}</time></>}</p><p>Time zone: {trip.data.time_zone}</p></div>

        </details>}

        <div className="hidden space-y-2 text-sm text-muted-foreground md:block">

          {trip.data.starts_at && trip.data.ends_at && <p><time dateTime={trip.data.starts_at}>{formatActivityTime(trip.data.starts_at, trip.data.time_zone)}</time> – <time dateTime={trip.data.ends_at}>{formatActivityTime(trip.data.ends_at, trip.data.time_zone)}</time></p>}

          <p>Time zone: {trip.data.time_zone}</p>

        </div>

      </div><div className="journey-header-art"><picture><source media="(max-width: 1023px)" srcSet="/illustrations/journey-header-mobile.svg" /><Image src="/illustrations/journey-header.svg" alt="" width={360} height={158} /></picture></div></div>}

      tools={<>

        <TripDialog title="People & invitations" description="See who is joining and manage access to this trip." keepMounted open={peopleOpen} onOpenChange={setPeopleOpen}

          trigger={<Button variant="outline" className="min-h-11"><Users aria-hidden="true" />People{members.data && <span className="text-muted-foreground">{members.data.length}</span>}</Button>}>

          <div className="space-y-6">

            {members.isPending ? <p role="status">Loading participants...</p> : members.isError ?

              <TripError error={members.error} retry={() => void members.refetch().then((result) => { if (result.isSuccess) setPermissionBlocked(false); })} pending={members.isFetching} /> :

              <Participants id={id} participants={members.data} current={current} onFailure={handleFailure} />}

            {allowed.manage && <Invitations id={id} onFailure={handleFailure} />}

          </div>

        </TripDialog>

        {allowed.edit && <TripDialog title="Trip settings" description="Update your destination, dates, and time zone." open={editing}

          onOpenChange={(open) => { if (!update.isPending && !remove.isPending) { update.reset(); setEditing(open); } }}

          trigger={<Button variant="outline" className="min-h-11"><Settings2 aria-hidden="true" />Settings</Button>}>

          <TripForm initialValue={trip.data} onSubmit={(input) => update.mutate(input)} pending={update.isPending} error={update.error} submitLabel="Save changes"

            cancel={<Button type="button" className="min-h-11" variant="outline" disabled={update.isPending} onClick={() => { update.reset(); setEditing(false); }}>Cancel</Button>} />

          {allowed.manage && <div className="mt-6 border-t pt-5">

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

          </div>}

        </TripDialog>}

      </>} />

  </>;

}
