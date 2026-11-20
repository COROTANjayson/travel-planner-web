"use client";

import { useState, type FormEvent } from "react";
import type { AssignableRole } from "@/lib/memberships";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InvitationError,
  useInvitationsApi,
} from "@/components/features/memberships/invitation-support";
import { RoleSelect } from "@/components/features/memberships/role-select";

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
      <h3 className="leading-[22px] font-semibold">Invite someone</h3>
      <form
        onSubmit={(event) => void create(event)}
        className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3"
      >
        <div className="col-span-2 space-y-2">
          <Label htmlFor="invite-email">Email they sign in with</Label>
          <Input
            id="invite-email"
            className="bg-card md:min-h-12"
            placeholder="name@example.com"
            type="email"
            required
            maxLength={320}
            disabled={api.pending}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="invite-role">Role</Label>
          <RoleSelect
            id="invite-role"
            value={role}
            disabled={api.pending}
            onChange={setRole}
          />
        </div>
        <Button
          className="h-12 font-normal"
          type="submit"
          disabled={api.pending}
        >
          {api.pending ? "Inviting…" : "Invite"}
        </Button>
      </form>
      <p className="text-[0.8125rem] leading-5 text-muted-foreground">
        They&apos;ll find it in their Invitations. No email is sent.
      </p>
      {api.error && <InvitationError error={api.error} />}
    </section>
  );
}
