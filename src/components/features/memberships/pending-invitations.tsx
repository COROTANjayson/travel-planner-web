"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  invitationExpiry,
  invitationStatus,
  participantInitials,
} from "@/lib/memberships";
import { Button } from "@/components/ui/button";
import { Confirmation } from "@/components/features/memberships/confirmation-dialog";
import {
  InvitationError,
  useInvitationsApi,
} from "@/components/features/memberships/invitation-support";
import { TripError } from "@/components/shared/trip-states";
import { ApiError } from "@/lib/api";

export function PendingInvitations({
  id,
  onFailure,
}: {
  id: number;
  onFailure: (error: Error) => void | Promise<void>;
}) {
  const api = useInvitationsApi(id, onFailure);
  const [revoke, setRevoke] = useState<{ id: number; email: string } | null>(
    null,
  );
  const invitations = useQuery({
    queryKey: ["trip", id, "invitations"],
    queryFn: ({ signal }) => api.invitations(signal),
    retry: false,
  });
  useEffect(() => {
    if (
      invitations.error instanceof ApiError &&
      invitations.error.status === 403
    )
      onFailure(invitations.error);
  }, [invitations.error, onFailure]);
  const waiting =
    invitations.data?.filter(
      (invitation) => invitationStatus(invitation) === "pending",
    ) ?? [];
  if (invitations.isSuccess && !waiting.length && !api.error && !revoke)
    return null;
  return (
    <section className="space-y-3" aria-label="Waiting to join">
      {waiting.length > 0 && (
        <h3 className="font-semibold">Waiting to join ({waiting.length})</h3>
      )}
      {api.error && <InvitationError error={api.error} />}
      {invitations.isPending ? (
        <p role="status">Loading invitations…</p>
      ) : invitations.isError ? (
        <TripError
          error={invitations.error}
          retry={() => void invitations.refetch()}
          pending={invitations.isFetching}
        />
      ) : (
        waiting.length > 0 && (
          <ul>
            {waiting.map((invitation) => (
              <li
                key={invitation.id}
                className="flex items-center gap-3 border-b py-3 first:pt-0 last:border-0 last:pb-0"
              >
                <span
                  className="participant-avatar flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-primary"
                  aria-hidden="true"
                >
                  {participantInitials({
                    display_name: "",
                    email: invitation.email,
                  })}
                </span>
                <div className="min-w-0 flex-1 break-words">
                  <p className="font-medium">{invitation.email}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <span className="capitalize">{invitation.role}</span> ·{" "}
                    <time dateTime={invitation.expires_at}>
                      {invitationExpiry(invitation)}
                    </time>
                  </p>
                </div>
                <Button
                  className="min-h-11"
                  variant="outline"
                  disabled={api.pending}
                  onClick={() => {
                    api.reset();
                    setRevoke(invitation);
                  }}
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )
      )}
      {revoke && (
        <Confirmation
          title="Revoke invitation?"
          description={`Revoke the invitation for ${revoke.email}?`}
          pending={api.pending}
          onCancel={() => setRevoke(null)}
          onConfirm={async () => {
            if (api.pending) return;
            try {
              await api.revoke(revoke.id);
            } catch {
              /* Safe error is shown above. */
            }
            setRevoke(null);
          }}
        />
      )}
    </section>
  );
}
