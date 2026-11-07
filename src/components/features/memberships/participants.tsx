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
import { RoleSelect } from "@/components/features/memberships/role-select";
import { OptionsMenu } from "@/components/shared/options-menu";
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
      <h3 className="font-semibold">On this trip ({participants.length})</h3>
      <ul>
        {participants.map((person) => (
          <li
            key={person.user_id}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b py-3 first:pt-0 last:border-0 last:pb-0"
          >
            <div className="participant-row min-w-0 flex-1">
              <span className="participant-avatar" aria-hidden="true">
                {Array.from(participantName(person))[0].toLocaleUpperCase()}
              </span>
              <p className="min-w-0 font-medium break-words">
                {participantName(person)}
                {person.user_id === current?.user_id && (
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    (you)
                  </span>
                )}
              </p>
            </div>
            {allowed.manage && person.role !== "owner" ? (
              <div className="flex w-full items-center gap-2 pl-14 sm:w-auto sm:pl-0">
                <RoleSelect
                  id={`role-${person.user_id}`}
                  label={`Role for ${participantName(person)}`}
                  value={person.role}
                  disabled={api.pending}
                  onChange={(role) => {
                    if (role !== person.role)
                      void api.updateRole(person.user_id, role).catch(() => {});
                  }}
                />
                <OptionsMenu
                  name={participantName(person)}
                  disabled={api.pending}
                  items={[
                    {
                      label: "Transfer ownership",
                      onClick: () => {
                        api.reset();
                        setConfirm({ action: "transfer", person });
                      },
                    },
                    {
                      label: "Remove",
                      destructive: true,
                      onClick: () => {
                        api.reset();
                        setConfirm({ action: "remove", person });
                      },
                    },
                  ]}
                />
              </div>
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
            title={
              confirm.action === "transfer"
                ? "Transfer ownership?"
                : confirm.action === "leave"
                  ? "Leave this trip?"
                  : "Remove participant?"
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
