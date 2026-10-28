"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type ApiUser, useApi } from "@/lib/api";
import { type ReceivedInvitation, useMembershipsApi } from "@/lib/memberships";
import { formatTripDates } from "@/lib/trips";
import { Button } from "@/components/ui/button";
import { TripError } from "@/components/trips/trip-states";

export default function InvitationsPage() {
  const request = useApi();
  const api = useMembershipsApi();
  const router = useRouter();
  const heading = useRef<HTMLHeadingElement>(null);
  const [action, setAction] = useState<{
    id: number;
    kind: "accept" | "decline";
  } | null>(null);
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => request<ApiUser>("/api/v1/me"),
    retry: false,
  });
  const verified = me.isSuccess && !!me.data?.email && me.data.email_verified;
  const invitations = useQuery({
    queryKey: ["invitations"],
    queryFn: ({ signal }) => api.receivedInvitations(signal),
    enabled: verified,
    retry: false,
  });

  async function respond(
    invitation: ReceivedInvitation,
    kind: "accept" | "decline",
  ) {
    if (!verified || api.pending || action) return;
    setAction({ id: invitation.id, kind });
    try {
      if (kind === "accept") {
        const participant = await api.accept(invitation.id);
        if (participant) router.replace(`/trips/${invitation.trip_id}`);
      } else {
        await api.decline(invitation.id);
        heading.current?.focus();
      }
    } catch {
      // The hook exposes a safe, recoverable error below.
    } finally {
      setAction(null);
    }
  }

  return (
    <section
      className="form-surface space-y-6"
      aria-labelledby="invitations-heading"
    >
      <div className="form-heading space-y-3">
        <h1
          id="invitations-heading"
          ref={heading}
          tabIndex={-1}
          className="page-title"
        >
          Invitations
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Your next trip, together. Accept an invitation to join the plan.
        </p>
      </div>
      {me.isPending ? (
        <p role="status">Checking your email…</p>
      ) : me.isError ? (
        <TripError
          error={me.error}
          retry={() => void me.refetch()}
          pending={me.isFetching}
        />
      ) : !verified ? (
        <div role="status" className="space-y-3 text-sm leading-6">
          <p>Invitations are matched to your verified email address.</p>
          <p className="break-words text-muted-foreground">
            {me.data?.email
              ? `Verify ${me.data.email} using the verification email from sign-up, then sign out and sign in again. Ask the trip owner to use this same address.`
              : "Your account has no email address. Sign in with an account that has the verified email address the trip owner invited."}
          </p>
        </div>
      ) : (
        <>
          <p className="break-words text-sm text-muted-foreground">
            Invitations for {me.data?.email}
          </p>
          {api.error && <TripError error={api.error} />}
          {invitations.isPending ? (
            <p role="status">Loading invitations…</p>
          ) : invitations.isError ? (
            <TripError
              error={invitations.error}
              retry={() => void invitations.refetch()}
              pending={invitations.isFetching}
            />
          ) : invitations.data.length === 0 ? (
            <div role="status" className="space-y-2">
              <h2 className="font-semibold">No pending invitations</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                When someone invites this email address, their trip will appear
                here. Invitations expire after seven days.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {invitations.data.map((invitation) => (
                <li
                  key={invitation.id}
                  className="space-y-4 py-6 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 space-y-2 break-words">
                    <h2 className="text-xl font-semibold">
                      {invitation.trip_name}
                    </h2>
                    <p>{invitation.destination}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatTripDates(
                        invitation.start_date,
                        invitation.end_date,
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Invited by{" "}
                      {invitation.inviter_name.trim() || "a traveler"} · Join as{" "}
                      {invitation.role}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Expires{" "}
                      <time dateTime={invitation.expires_at}>
                        {new Date(invitation.expires_at).toLocaleString()}
                      </time>
                    </p>
                  </div>
                  <div
                    className="flex flex-wrap gap-3"
                    role="group"
                    aria-label={`Respond to invitation for ${invitation.trip_name}`}
                  >
                    <Button
                      className="min-h-12"
                      disabled={api.pending || !!action}
                      onClick={() => void respond(invitation, "accept")}
                    >
                      {action?.id === invitation.id && action.kind === "accept"
                        ? "Accepting…"
                        : "Accept"}
                    </Button>
                    <Button
                      className="min-h-12"
                      variant="outline"
                      disabled={api.pending || !!action}
                      onClick={() => void respond(invitation, "decline")}
                    >
                      {action?.id === invitation.id && action.kind === "decline"
                        ? "Declining…"
                        : "Decline"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
