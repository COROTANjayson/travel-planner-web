"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  type Participant,
  participantName,
  permissions,
  useMembershipsApi,
} from "@/lib/memberships";
import { Button } from "@/components/ui/button";
import { Confirmation } from "@/components/features/memberships/confirmation-dialog";
import { MemberRoleMenu } from "@/components/features/memberships/member-role-menu";
import { TripError } from "@/components/shared/trip-states";

export function Participants({
  id,
  participants,
  current,
  onFailure,
}: {
  id: number;
  participants: Participant[];
  current?: Participant;
  onFailure: (error: Error) => void | Promise<void>;
}) {
  const api = useMembershipsApi(id, onFailure);
  const router = useRouter();
  const allowed = permissions(current?.role);
  const [confirm, setConfirm] = useState<{
    action: "remove" | "leave" | "transfer";
    person: Participant;
  } | null>(null);
  async function submit() {
    if (!confirm || api.pending) return;
    if (confirm.action === "leave" ? !allowed.leave : !allowed.manage) return;
    try {
      if (confirm.action === "transfer")
        await api.transfer(confirm.person.user_id);
      else await api.remove(confirm.person.user_id, confirm.action === "leave");
      if (confirm.action === "leave") router.replace("/trips");
    } catch {
      /* The hook exposes a safe error below. */
    }
    setConfirm(null);
  }
  return (
    <section className="space-y-3" aria-label="On this trip">
      <ul className="divide-y rounded-[16px] border bg-card">
        {participants.map((person) => (
          <li
            key={person.user_id}
            className="flex min-h-16 items-center gap-3 py-3 pr-3 pl-3.5 md:pl-4"
          >
            <div className="participant-row flex items-center gap-3 min-w-0 flex-1">
              <span
                className="participant-avatar flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-primary"
                aria-hidden="true"
              >
                {Array.from(participantName(person))[0].toLocaleUpperCase()}
              </span>
              <div className="min-w-0 space-y-0.5">
                <p
                  className="truncate leading-[22px] font-semibold"
                  title={participantName(person)}
                >
                  {participantName(person)}
                  {person.user_id === current?.user_id && (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      (you)
                    </span>
                  )}
                </p>
                {person.email &&
                  person.email !== person.display_name.trim() && (
                    <p
                      className="truncate text-[0.8125rem] leading-5 text-muted-foreground"
                      title={person.email}
                    >
                      {person.email}
                    </p>
                  )}
              </div>
            </div>
            {allowed.manage && person.role !== "owner" ? (
              <MemberRoleMenu
                name={participantName(person)}
                role={person.role}
                disabled={api.pending}
                onChange={(role) => {
                  void api.updateRole(person.user_id, role).catch(() => {});
                }}
                onTransfer={() => {
                  api.reset();
                  setConfirm({ action: "transfer", person });
                }}
                onRemove={() => {
                  api.reset();
                  setConfirm({ action: "remove", person });
                }}
              />
            ) : (
              <span className="shrink-0 text-sm text-muted-foreground capitalize">
                {person.role}
              </span>
            )}
          </li>
        ))}
      </ul>
      {allowed.leave && current && (
        <Button
          className="mt-3 min-h-11"
          variant="outline"
          disabled={api.pending}
          onClick={() => {
            api.reset();
            setConfirm({ action: "leave", person: current });
          }}
        >
          Leave trip
        </Button>
      )}
      {api.error && <TripError error={api.error} />}
      {confirm &&
        (confirm.action === "leave" ? allowed.leave : allowed.manage) && (
          <Confirmation
            pending={api.pending}
            destructiveLabel={
              confirm.action === "remove"
                ? "Remove"
                : confirm.action === "leave"
                  ? "Leave trip"
                  : undefined
            }
            title={
              confirm.action === "transfer"
                ? "Transfer ownership?"
                : confirm.action === "leave"
                  ? "Leave this trip?"
                  : "Remove from trip?"
            }
            description={
              confirm.action === "transfer"
                ? `Make ${participantName(confirm.person)} the owner? You will become an editor.`
                : confirm.action === "leave"
                  ? "You will lose access to this trip. Your financial records and balances remain available to the remaining travelers."
                  : `Remove ${participantName(confirm.person)} from this trip? They will lose access. Their financial records and balances remain available to the remaining travelers.`
            }
            onCancel={() => setConfirm(null)}
            onConfirm={() => void submit()}
          />
        )}
    </section>
  );
}
