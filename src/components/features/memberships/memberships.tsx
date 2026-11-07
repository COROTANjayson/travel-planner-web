"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import {
  type AssignableRole,
  type Participant,
  invitationExpiry,
  invitationStatus,
  participantInitials,
  participantName,
  permissions,
  useMembershipsApi,
} from "@/lib/memberships";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TripError } from "@/components/shared/trip-states";
import { ApiError } from "@/lib/api";

const roleHelp: Record<AssignableRole, string> = {
  editor: "Can change the trip, activities, and all expenses",
  member: "Can view plans and record expenses and payments",
  viewer: "Can view the trip but can't change anything",
};

function RoleSelect({
  id,
  label,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label?: string;
  value: AssignableRole;
  disabled: boolean;
  onChange: (role: AssignableRole) => void;
}) {
  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(role) => {
        if (role === "editor" || role === "member" || role === "viewer")
          onChange(role);
      }}
    >
      <SelectTrigger id={id} aria-label={label} className="w-full sm:w-32">
        <SelectValue className="capitalize" />
      </SelectTrigger>
      <SelectContent
        align="end"
        alignItemWithTrigger={false}
        className="w-88 max-w-(--available-width) p-1"
      >
        {(["editor", "member", "viewer"] as const).map((role) => (
          <SelectItem className="min-h-11 py-2" key={role} value={role}>
            <span className="flex flex-col whitespace-normal">
              <span className="font-medium capitalize">{role}</span>
              <span className="text-xs leading-5 text-muted-foreground">
                {roleHelp[role]}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PersonOptions({
  name,
  disabled,
  onTransfer,
  onRemove,
}: {
  name: string;
  disabled: boolean;
  onTransfer: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        render={
          <Button
            variant="ghost"
            className="size-11 min-h-11"
            aria-label={`More options for ${name}`}
          />
        }
      >
        <MoreHorizontal aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-56 max-w-[calc(100vw-3rem)] gap-0 p-1"
      >
        <PopoverTitle className="sr-only">Options for {name}</PopoverTitle>
        <Button
          variant="ghost"
          className="min-h-11 w-full justify-start"
          onClick={() => {
            setOpen(false);
            onTransfer();
          }}
        >
          Transfer ownership
        </Button>
        <Button
          variant="ghost"
          className="min-h-11 w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => {
            setOpen(false);
            onRemove();
          }}
        >
          Remove
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function Confirmation({
  title,
  description,
  pending,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onCancel();
      }}
    >
      <AlertDialogContent className="w-[calc(100%-2rem)]">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="break-words">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-11" disabled={pending}>
            Cancel
          </AlertDialogCancel>
          <Button className="min-h-11" disabled={pending} onClick={onConfirm}>
            {pending ? "Saving…" : "Confirm"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

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
                <PersonOptions
                  name={participantName(person)}
                  disabled={api.pending}
                  onTransfer={() => {
                    api.reset();
                    setConfirm({ action: "transfer", person });
                  }}
                  onRemove={() => {
                    api.reset();
                    setConfirm({ action: "remove", person });
                  }}
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

function useInvitationsApi(
  id: number,
  onFailure: (error: Error) => void | Promise<void>,
) {
  return useMembershipsApi(id, (error) => {
    if (!(error instanceof ApiError && error.status === 404))
      return onFailure(error);
  });
}

function InvitationError({ error }: { error: Error }) {
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

export function InviteForm({
  id,
  onFailure,
}: {
  id: number;
  onFailure: (error: Error) => void | Promise<void>;
}) {
  const api = useInvitationsApi(id, onFailure);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableRole>("member");
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (api.pending) return;
    try {
      const invitation = await api.create(email, role);
      if (invitation) {
        setEmail("");
      }
    } catch {
      /* The hook exposes a safe error below. */
    }
  }
  return (
    <section className="space-y-3" aria-label="Invite someone">
      <h3 className="font-semibold">Invite someone</h3>
      <form
        onSubmit={(event) => void create(event)}
        className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end sm:gap-x-2"
      >
        <div className="space-y-2">
          <Label htmlFor="invite-email">Email they sign in with</Label>
          <Input
            id="invite-email"
            type="email"
            required
            maxLength={320}
            disabled={api.pending}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="invite-role">Role</Label>
          <RoleSelect
            id="invite-role"
            value={role}
            disabled={api.pending}
            onChange={setRole}
          />
        </div>
        <Button
          className="w-full sm:w-auto md:min-h-11"
          type="submit"
          disabled={api.pending}
        >
          {api.pending ? "Inviting…" : "Invite"}
        </Button>
      </form>
      <p className="text-sm leading-6 text-muted-foreground">
        They&apos;ll find it in their Invitations. No email is sent.
      </p>
      {api.error && <InvitationError error={api.error} />}
    </section>
  );
}

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
                <span className="participant-avatar" aria-hidden="true">
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
