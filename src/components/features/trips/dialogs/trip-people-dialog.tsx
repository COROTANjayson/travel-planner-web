"use client";

import { Users } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { InviteForm } from "@/components/features/memberships/invite-form";
import { Participants } from "@/components/features/memberships/participants";
import { PendingInvitations } from "@/components/features/memberships/pending-invitations";
import { TripDialog } from "@/components/shared/trip-dialog";
import { TripError } from "@/components/shared/trip-states";
import { Button } from "@/components/ui/button";
import { participantInitials, type Participant } from "@/lib/memberships";

export function TripPeopleDialog({
  id,
  members,
  current,
  canManage,
  peopleOpen,
  setPeopleOpen,
  setPermissionBlocked,
  handleFailure,
}: {
  id: number;
  members: UseQueryResult<Participant[]>;
  current?: Participant;
  canManage: boolean;
  peopleOpen: boolean;
  setPeopleOpen: (open: boolean) => void;
  setPermissionBlocked: (blocked: boolean) => void;
  handleFailure: (error: Error) => void | Promise<void>;
}) {
  return (
    <TripDialog
      title="People"
      className="[&_[data-slot=trip-dialog-header]]:items-center"
      keepMounted
      open={peopleOpen}
      onOpenChange={setPeopleOpen}
      trigger={
        <Button
          variant="ghost"
          className="trip-people min-h-11 [&[data-slot='button']]:[border-radius:9999px] [&[data-slot='button']]:[padding-inline:0.375rem]"
          aria-label={
            members.data ? `People, ${members.data.length}` : "People"
          }
        >
          {members.data?.length ? (
            <span
              aria-hidden="true"
              className="trip-people-avatars [display:flex] [&>span]:[display:grid] [&>span]:[min-width:2rem] [&>span]:[min-height:2rem] [&>span]:[place-items:center] [&>span]:[border:2px_solid_var(--background)] [&>span]:[border-radius:9999px] [&>span]:[background:var(--trip-sea)] [&>span]:[color:var(--foreground)] [&>span]:[padding-inline:0.125rem] [&>span]:[font-size:0.6875rem] [&>span]:[font-weight:600] [&_>_span_+_span]:[margin-left:-0.5rem]"
            >
              {members.data.slice(0, 3).map((person) => (
                <span key={person.user_id}>{participantInitials(person)}</span>
              ))}
              {members.data.length > 3 && (
                <span>+{members.data.length - 3}</span>
              )}
            </span>
          ) : (
            <>
              <Users aria-hidden="true" />
              People
            </>
          )}
        </Button>
      }
    >
      <div className="space-y-8">
        {canManage && <InviteForm id={id} onFailure={handleFailure} />}
        {members.isPending ? (
          <p role="status">Loading participants...</p>
        ) : members.isError ? (
          <TripError
            error={members.error}
            retry={() =>
              void members.refetch().then((result) => {
                if (result.isSuccess) setPermissionBlocked(false);
              })
            }
            pending={members.isFetching}
          />
        ) : (
          <Participants
            id={id}
            participants={members.data}
            current={current}
            onFailure={handleFailure}
          />
        )}
        {canManage && <PendingInvitations id={id} onFailure={handleFailure} />}
      </div>
    </TripDialog>
  );
}
