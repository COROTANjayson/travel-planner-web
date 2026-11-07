"use client";

import { TripSummary } from "@/components/features/trips/trip-summary";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, type ApiUser, useApi } from "@/lib/api";
import { permissions, useMembershipsApi } from "@/lib/memberships";
import { Expenses } from "@/components/features/expenses/expenses";
import { Prep } from "@/components/features/prep/prep";
import { Itinerary } from "@/components/features/itinerary/itinerary";
import { type TripInput, useTripsApi } from "@/lib/trips";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { TripOptionsDialog } from "@/components/features/trips/dialogs/trip-options-dialog";
import { TripPeopleDialog } from "@/components/features/trips/dialogs/trip-people-dialog";
import { TripSettingsDialog } from "@/components/features/trips/dialogs/trip-settings-dialog";
import {
  TripViewSwitch,
  tripViews,
} from "@/components/features/trips/trip-view-switch";
import {
  TripError,
  TripLoading,
  TripNotFound,
} from "@/components/shared/trip-states";

export function TripDetail({ id }: { id: number }) {
  const searchParams = useSearchParams();
  const view = searchParams.get("view") ?? "";
  // An activity dialog always opens over the itinerary.
  const shown = searchParams.has("activity") ? "" : view;
  const expenseView = shown === "expenses";
  const prepView = shown === "prep";
  const [itineraryDate, setItineraryDate] = useState<string>();
  const api = useTripsApi();
  const queryClient = useQueryClient();
  const router = useRouter();
  const request = useApi();
  const memberships = useMembershipsApi(id);
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => request<ApiUser>("/api/v1/me"),
    retry: false,
  });
  const members = useQuery({
    queryKey: ["trip", id, "members"],
    queryFn: ({ signal }) => memberships.members(signal),
    retry: false,
  });
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const [accessError, setAccessError] = useState<Error | null>(null);
  const current =
    me.isSuccess && members.isSuccess && !permissionBlocked
      ? members.data.find((person) => person.user_id === me.data?.id)
      : undefined;
  const allowed = permissions(current?.role);
  const handleFailure = useCallback(
    (error: Error) => {
      if (!(error instanceof ApiError)) return;
      if (error.status === 404) setAccessError(error);
      if (error.status === 403 || error.status === 409) {
        setAccessError(error);
        setPermissionBlocked(true);
        return queryClient
          .refetchQueries({ queryKey: ["trip", id, "members"] })
          .then(() => {
            if (
              queryClient.getQueryState(["trip", id, "members"])?.status ===
              "success"
            )
              setPermissionBlocked(false);
          });
      }
    },
    [id, queryClient],
  );
  const [editing, setEditing] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const trip = useQuery({
    queryKey: ["trip", id],
    queryFn: ({ signal }) => api.get(id, signal),
    retry: false,
  });
  const update = useMutation({
    onError: (error: Error) => {
      if (!(error instanceof ApiError && error.status === 409))
        handleFailure(error);
    },
    mutationFn: (input: TripInput) => api.update(id, input),
    onSuccess: async (saved) => {
      queryClient.setQueryData(["trip", id], saved);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["trips"] }),
        queryClient.invalidateQueries({ queryKey: ["trip", id], exact: true }),
        queryClient.invalidateQueries({ queryKey: ["trip", id, "activities"] }),
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

  if (
    [trip.error, members.error, accessError, update.error, remove.error].some(
      (error) => error instanceof ApiError && error.status === 404,
    )
  ) {
    return <TripNotFound />;
  }
  if (!trip.data) {
    return trip.isError ? (
      <TripError
        error={trip.error}
        retry={() => void trip.refetch()}
        pending={trip.isFetching}
      />
    ) : (
      <TripLoading />
    );
  }

  return (
    <div className="trip-detail mx-auto flex w-full max-w-6xl flex-col gap-3">
      <div className="mobile-trip-header fixed inset-x-0 top-0 z-40 flex items-center gap-2 border-b bg-background px-3 md:hidden">
        <Button
          variant="ghost"
          className="size-12 shrink-0"
          aria-label="Back to trips"
          render={<Link href="/trips" />}
          nativeButton={false}
        >
          <ArrowLeft aria-hidden="true" />
        </Button>
        <p className="min-w-0 flex-1 text-sm font-medium">
          {`Trip ${(tripViews[shown] ?? "Itinerary").toLowerCase()}`}
        </p>
        <TripOptionsDialog
          tripName={trip.data.name}
          memberCount={members.data?.length}
          canEdit={allowed.edit}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          peopleOpen={peopleOpen}
          setPeopleOpen={setPeopleOpen}
          editing={editing}
          setEditing={setEditing}
        />
      </div>
      {accessError && <TripError error={accessError} />}
      {trip.isError && (
        <TripError
          error={trip.error}
          retry={() => void trip.refetch()}
          pending={trip.isFetching}
        />
      )}
      {me.isError && (
        <TripError
          error={me.error}
          retry={() => void me.refetch()}
          pending={me.isFetching}
        />
      )}
      <header className="planning-header">
        <div className="min-w-0 flex-1">
          <TripSummary trip={trip.data} />
        </div>
        <nav
          aria-label="Trip tools"
          className="hidden shrink-0 flex-wrap gap-2 md:flex"
        >
          <>
            <Button
              className="trip-back min-h-11"
              variant="ghost"
              aria-label="Back to trips"
              render={<Link href="/trips" />}
              nativeButton={false}
            >
              <ArrowLeft aria-hidden="true" />
              Back to trips
            </Button>
            <TripPeopleDialog
              id={id}
              members={members}
              current={current}
              canManage={allowed.manage}
              peopleOpen={peopleOpen}
              setPeopleOpen={setPeopleOpen}
              setPermissionBlocked={setPermissionBlocked}
              handleFailure={handleFailure}
            />
            {allowed.edit && (
              <TripSettingsDialog
                trip={trip.data}
                canManage={allowed.manage}
                editing={editing}
                setEditing={setEditing}
                confirming={confirming}
                setConfirming={setConfirming}
                update={update}
                remove={remove}
              />
            )}
          </>
        </nav>
      </header>
      <TripViewSwitch tripID={id} view={view} />
      <Expenses
        active={expenseView}
        trip={trip.data}
        participants={members.data}
        current={current}
        onFailure={handleFailure}
      />
      {prepView && (
        <Prep
          trip={trip.data}
          participants={members.data}
          current={current}
          canEdit={allowed.edit}
          onFailure={handleFailure}
        />
      )}
      {!expenseView && !prepView && (
        <Itinerary
          trip={trip.data}
          participants={members.data}
          canEdit={allowed.edit}
          current={current}
          onFailure={handleFailure}
          initialDate={itineraryDate}
          onDateChange={setItineraryDate}
        />
      )}
    </div>
  );
}
