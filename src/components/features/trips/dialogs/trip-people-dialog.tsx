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
          className="trip-people min-h-11"
          aria-label={
            members.data ? `People, ${members.data.length}` : "People"
          }
        >
          {members.data?.length ? (
            <span aria-hidden="true" className="trip-people-avatars">
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
