"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, useApi } from "@/lib/api";
import { toast } from "sonner";

export type TripRole = "owner" | "editor" | "member" | "viewer";
export type AssignableRole = Exclude<TripRole, "owner">;
export interface Participant {
  user_id: number;
  email: string | null;
  display_name: string;
  role: TripRole;
}
export interface Invitation {
  id: number;
  trip_id: number;
  email: string;
  role: AssignableRole;
  invited_by_user_id: number;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  declined_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface ReceivedInvitation {
  id: number;
  trip_id: number;
  trip_name: string;
  destination: string;
  start_date: string;
  end_date: string;
  role: AssignableRole;
  inviter_name: string;
  expires_at: string;
}
export const acceptanceError =
  "This invitation is no longer available. Refresh your invitations and try again.";
export const participantName = (person: Participant) =>
  person.display_name.trim() || person.email || "Traveler";
export function invitationStatus(invitation: Invitation, now = Date.now()) {
  return invitation.revoked_at
    ? "revoked"
    : invitation.accepted_at
      ? "accepted"
      : invitation.declined_at
        ? "declined"
        : Date.parse(invitation.expires_at) <= now
          ? "expired"
          : "pending";
}
export function permissions(role?: TripRole) {
  return {
    manage: role === "owner",
    edit: role === "owner" || role === "editor",
    leave: !!role && role !== "owner",
  };
}

export function useMembershipsApi(
  tripID?: number,
  onFailure?: (error: Error) => void | Promise<void>,
) {
  const api = useApi();
  const client = useQueryClient();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const base = `/api/v1/trips/${tripID}`;
  const membersKey = ["trip", tripID, "members"];
  const invitationsKey = ["trip", tripID, "invitations"];
  async function read<T>(path: string, signal?: AbortSignal) {
    const data = await api<T>(path, { signal });
    if (data === undefined)
      throw new ApiError(500, "Unable to load data. Please try again.");
    return data;
  }
  async function mutate<T>(
    path: string,
    method: string,
    body: object | undefined,
    kind: "members" | "invitations" | "leave" | "accept" | "decline",
    successMessage?: string,
  ): Promise<T | undefined> {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await api<T>(path, {
        method,
        ...(body
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }
          : {}),
      });
      if (kind === "leave") {
        await client.cancelQueries({ queryKey: ["trip", tripID] });
        client.removeQueries({ queryKey: ["trip", tripID] });
      }
      await Promise.all(
        kind === "invitations"
          ? [client.invalidateQueries({ queryKey: invitationsKey })]
          : [
              ...(kind === "accept" || kind === "decline"
                ? [client.invalidateQueries({ queryKey: ["invitations"] })]
                : []),
              ...(kind !== "decline"
                ? [client.invalidateQueries({ queryKey: ["trips"] })]
                : []),
              ...(kind === "members"
                ? [
                    client.invalidateQueries({ queryKey: membersKey }),
                    client.invalidateQueries({
                      queryKey: ["trip", tripID],
                      exact: true,
                    }),
                  ]
                : []),
            ],
      );
      if (successMessage) toast.success(successMessage);
      return result;
    } catch (cause) {
      const failure =
        kind === "accept" || kind === "decline"
          ? new ApiError(
              cause instanceof ApiError ? cause.status : 500,
              cause instanceof ApiError && [400, 404].includes(cause.status)
                ? acceptanceError
                : `Unable to ${kind === "accept" ? "accept" : "decline"} this invitation. Please try again.`,
            )
          : cause instanceof ApiError
            ? cause
            : new Error("Something went wrong. Please try again.");
      setError(failure);
      await onFailure?.(failure);
      if (
        (kind === "accept" || kind === "decline") &&
        failure instanceof ApiError &&
        [400, 403, 404, 409].includes(failure.status)
      ) {
        await client.invalidateQueries({ queryKey: ["invitations"] });
      }
      if (
        failure instanceof ApiError &&
        [403, 404, 409].includes(failure.status) &&
        tripID !== undefined
      ) {
        await client.invalidateQueries({ queryKey: membersKey });
        if (kind === "invitations" && failure.status !== 403)
          await client.invalidateQueries({ queryKey: invitationsKey });
      }
      throw failure;
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return {
    pending,
    error,
    reset: () => setError(null),
    members: (signal?: AbortSignal) =>
      read<Participant[]>(`${base}/members`, signal),
    invitations: (signal?: AbortSignal) =>
      read<Invitation[]>(`${base}/invitations`, signal),
    create: (email: string, role: AssignableRole) =>
      mutate<Invitation>(
        `${base}/invitations`,
        "POST",
        { email: email.trim(), role },
        "invitations",
        "Invitation created.",
      ),
    revoke: (id: number) =>
      mutate<void>(
        `${base}/invitations/${id}`,
        "DELETE",
        undefined,
        "invitations",
      ),
    updateRole: (id: number, role: AssignableRole) =>
      mutate<Participant>(
        `${base}/members/${id}`,
        "PUT",
        { role },
        "members",
        "Participant role updated.",
      ),
    remove: (id: number, leave = false) =>
      mutate<void>(
        `${base}/members/${id}`,
        "DELETE",
        undefined,
        leave ? "leave" : "members",
      ),
    transfer: (id: number) =>
      mutate<void>(
        `${base}/transfer-ownership`,
        "POST",
        { user_id: id },
        "members",
        "Ownership transferred.",
      ),
    receivedInvitations: (signal?: AbortSignal) =>
      read<ReceivedInvitation[]>("/api/v1/invitations", signal),
    decline: (id: number) =>
      mutate<void>(
        `/api/v1/invitations/${id}/decline`,
        "POST",
        undefined,
        "decline",
        "Invitation declined.",
      ),
    accept: (id: number) =>
      mutate<Participant>(
        `/api/v1/invitations/${id}/accept`,
        "POST",
        undefined,
        "accept",
        "Invitation accepted.",
      ),
  };
}
