"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, type ApiUser, useApi } from "@/lib/api";
import { permissions, useMembershipsApi } from "@/lib/memberships";
import { Expenses } from "@/components/features/expenses/expenses";
import { Itinerary } from "@/components/features/itinerary/itinerary";
import {
  formatTripDates,
  tripDayCount,
  tripStatus,
  type TripInput,
  useTripsApi,
} from "@/lib/trips";
import { formatActivityTime } from "@/lib/activity-time";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, CalendarDays, Clock3 } from "lucide-react";
import { TripOptionsDialog } from "@/components/features/trips/dialogs/trip-options-dialog";
import { TripPeopleDialog } from "@/components/features/trips/dialogs/trip-people-dialog";
import { TripSettingsDialog } from "@/components/features/trips/dialogs/trip-settings-dialog";
import {
  TripError,
  TripLoading,
  TripNotFound,
} from "@/components/shared/trip-states";

export function TripDetail({ id }: { id: number }) {
  const searchParams = useSearchParams();
  const expenseView =
    searchParams.get("view") === "expenses" && !searchParams.has("activity");
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
          {expenseView ? "Trip expenses" : "Trip itinerary"}
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
          <div className="trip-summary">
            <div className="trip-summary-destination">
              <p className="flex min-w-0 items-start gap-2 text-sm text-muted-foreground">
                <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span className="min-w-0 break-words">
                  {trip.data.destination}
                </span>
              </p>
              <span
                className="trip-status"
                data-status={tripStatus(
                  trip.data.start_date,
                  trip.data.end_date,
                  trip.data.time_zone,
                )}
              >
                {tripStatus(
                  trip.data.start_date,
                  trip.data.end_date,
                  trip.data.time_zone,
                )}
              </span>
            </div>
            <h1 className="trip-summary-title">{trip.data.name}</h1>
            <div className="trip-summary-meta">
              <p className="flex items-start gap-2">
                <CalendarDays
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0"
                />
                <span>
                  {formatTripDates(trip.data.start_date, trip.data.end_date)}
                </span>
              </p>
              <p>
                {tripDayCount(trip.data.start_date, trip.data.end_date)}{" "}
                {tripDayCount(trip.data.start_date, trip.data.end_date) === 1
                  ? "day"
                  : "days"}
              </p>
              <p className="flex min-w-0 items-start gap-2">
                <Clock3 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span className="break-words">{trip.data.time_zone}</span>
              </p>
              {trip.data.starts_at && trip.data.ends_at && (
                <p>
                  <time dateTime={trip.data.starts_at}>
                    {formatActivityTime(
                      trip.data.starts_at,
                      trip.data.time_zone,
                    )}
                  </time>{" "}
                  &ndash;{" "}
                  <time dateTime={trip.data.ends_at}>
                    {formatActivityTime(trip.data.ends_at, trip.data.time_zone)}
                  </time>
                </p>
              )}
            </div>
          </div>
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
      <Expenses
        active={expenseView}
        trip={trip.data}
        participants={members.data}
        current={current}
        onFailure={handleFailure}
      />
      {!expenseView && (
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
