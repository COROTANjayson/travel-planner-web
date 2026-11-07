"use client";

import { TripError } from "@/components/shared/trip-states";
import { ApiError } from "@/lib/api";
import { useMembershipsApi } from "@/lib/memberships";

export function useInvitationsApi(
  id: number,
  onFailure: (error: Error) => void | Promise<void>,
) {
  return useMembershipsApi(id, (error) => {
    if (!(error instanceof ApiError && error.status === 404))
      return onFailure(error);
  });
}

export function InvitationError({ error }: { error: Error }) {
  return (
    <TripError
      error={
        error instanceof ApiError && error.status === 404
          ? new ApiError(404, "This invitation is unavailable.")
          : error
      }
    />
  );
}
