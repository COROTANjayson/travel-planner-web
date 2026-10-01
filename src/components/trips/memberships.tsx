"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type AssignableRole, type Participant, invitationStatus, participantName, permissions, useMembershipsApi } from "@/lib/memberships";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TripError } from "@/components/trips/trip-states";
import { ApiError } from "@/lib/api";

function RoleSelect({ id, value, disabled, onChange }: { id: string; value: AssignableRole; disabled: boolean; onChange: (role: AssignableRole) => void }) {
  return <Select value={value} disabled={disabled} onValueChange={(role) => {
    if (role === "editor" || role === "member" || role === "viewer") onChange(role);
  }}>
    <SelectTrigger id={id} className="min-h-11 w-full sm:w-36"><SelectValue /></SelectTrigger>
    <SelectContent>{(["editor", "member", "viewer"] as const).map((role) =>
      <SelectItem className="min-h-11" key={role} value={role}>{role}</SelectItem>)}</SelectContent>
  </Select>;
}

function Confirmation({ title, description, pending, onCancel, onConfirm }: {
  title: string; description: string; pending: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  return <AlertDialog open onOpenChange={(open) => { if (!open && !pending) onCancel(); }}>
    <AlertDialogContent className="w-[calc(100%-2rem)]">
      <AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription className="break-words">{description}</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel className="min-h-11" disabled={pending}>Cancel</AlertDialogCancel>
        <Button className="min-h-11" disabled={pending} onClick={onConfirm}>{pending ? "Saving…" : "Confirm"}</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}

export function Participants({ id, participants, current, onFailure }: {
  id: number; participants: Participant[]; current?: Participant; onFailure: (error: Error) => void | Promise<void>;
}) {
  const api = useMembershipsApi(id, onFailure);
  const router = useRouter();
  const allowed = permissions(current?.role);
  const [confirm, setConfirm] = useState<{ action: "remove" | "leave" | "transfer"; person: Participant } | null>(null);
  async function submit() {
    if (!confirm || api.pending) return;
    if (confirm.action === "leave" ? !allowed.leave : !allowed.manage) return;
    try {
      if (confirm.action === "transfer") await api.transfer(confirm.person.user_id);
      else await api.remove(confirm.person.user_id, confirm.action === "leave");
      if (confirm.action === "leave") router.replace("/trips");
    } catch { /* The hook exposes a safe error below. */ }
    setConfirm(null);
  }
  return <Card><CardHeader><CardTitle>Participants</CardTitle></CardHeader><CardContent className="space-y-4">
    <ul className="space-y-4">{participants.map((person) => <li key={person.user_id} className="space-y-3 border-b pb-4 last:border-0 last:pb-0">
      <div className="break-words"><p className="font-medium">{participantName(person)}{person.user_id === current?.user_id && " (you)"}</p><p className="text-sm text-muted-foreground">{person.role}</p></div>
      {allowed.manage && person.role !== "owner" && <div className="flex flex-wrap items-end gap-3">
        <div className="w-full space-y-2 sm:w-auto"><Label htmlFor={`role-${person.user_id}`}>Role for {participantName(person)}</Label>
          <RoleSelect id={`role-${person.user_id}`} value={person.role} disabled={api.pending} onChange={(role) => {
            if (role !== person.role) void api.updateRole(person.user_id, role).catch(() => {});
          }} /></div>
        <Button className="min-h-11" variant="outline" disabled={api.pending} onClick={() => { api.reset(); setConfirm({ action: "remove", person }); }}>Remove</Button>
        <Button className="min-h-11" variant="outline" disabled={api.pending} onClick={() => { api.reset(); setConfirm({ action: "transfer", person }); }}>Transfer ownership</Button>
      </div>}
    </li>)}</ul>
    {allowed.leave && current && <Button className="min-h-11" variant="outline" disabled={api.pending} onClick={() => { api.reset(); setConfirm({ action: "leave", person: current }); }}>Leave trip</Button>}
    {api.error && <TripError error={api.error} />}
    {confirm && (confirm.action === "leave" ? allowed.leave : allowed.manage) && <Confirmation pending={api.pending} title={confirm.action === "transfer" ? "Transfer ownership?" : confirm.action === "leave" ? "Leave this trip?" : "Remove participant?"}
      description={confirm.action === "transfer" ? `Make ${participantName(confirm.person)} the owner? You will become an editor.` : confirm.action === "leave" ? "You will lose access to this trip." : `Remove ${participantName(confirm.person)} from this trip? They will lose access.`}
      onCancel={() => setConfirm(null)} onConfirm={() => void submit()} />}
  </CardContent></Card>;
}

export function Invitations({ id, onFailure }: { id: number; onFailure: (error: Error) => void | Promise<void> }) {
  const api = useMembershipsApi(id, (error) => {
    if (!(error instanceof ApiError && error.status === 404)) return onFailure(error);
  });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableRole>("member");
  const [token, setToken] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [revoke, setRevoke] = useState<{ id: number; email: string } | null>(null);
  const invitations = useQuery({ queryKey: ["trip", id, "invitations"], queryFn: ({ signal }) => api.invitations(signal), retry: false });
  useEffect(() => {
    if (invitations.error instanceof ApiError && invitations.error.status === 403) onFailure(invitations.error);
  }, [invitations.error, onFailure]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (api.pending) return;
    setToken(""); setCopyStatus("");
    try {
      const invitation = await api.create(email, role);
      if (invitation) { setToken(invitation.token); setEmail(""); }
    } catch { /* The hook exposes a safe error below. */ }
  }
  return <Card><CardHeader><CardTitle>Invitations</CardTitle></CardHeader><CardContent className="space-y-6">
    <form onSubmit={(event) => void create(event)} className="space-y-4">
      <div className="space-y-2"><Label htmlFor="invite-email">Email address</Label><Input className="min-h-11" id="invite-email" type="email" required maxLength={320} disabled={api.pending} value={email} onChange={(event) => setEmail(event.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="invite-role">Invitation role</Label><RoleSelect id="invite-role" value={role} disabled={api.pending} onChange={setRole} /></div>
      <Button className="min-h-11" type="submit" disabled={api.pending}>{api.pending ? "Saving…" : "Create invitation"}</Button>
    </form>
    {token && <div className="space-y-3 rounded-lg border p-4">
      <Label htmlFor="created-token">Invitation token</Label><Input className="min-h-11 font-mono" id="created-token" readOnly value={token} autoComplete="off" />
      <p className="text-sm text-muted-foreground">Copy this token now and share it with the invited person. It cannot be retrieved again.</p>
      <div className="flex flex-wrap gap-3"><Button className="min-h-11" variant="outline" onClick={async () => {
        try { await navigator.clipboard.writeText(token); setCopyStatus("Token copied."); }
        catch { setCopyStatus("Could not copy. Select the token and copy it manually."); }
      }}>Copy token</Button><Button className="min-h-11" variant="outline" onClick={() => { setToken(""); setCopyStatus(""); }}>Dismiss</Button></div>
      {copyStatus && <p role="status" className="text-sm">{copyStatus}</p>}
    </div>}
    {api.error && <TripError error={api.error instanceof ApiError && api.error.status === 404 ? new ApiError(404, "This invitation is unavailable.") : api.error} />}
    {invitations.isPending ? <p role="status">Loading invitations…</p> : invitations.isError ? <TripError error={invitations.error} retry={() => void invitations.refetch()} pending={invitations.isFetching} /> : invitations.data.length === 0 ? <p className="text-muted-foreground">No invitations yet.</p> :
      <ul className="space-y-4">{invitations.data.map((invitation) => <li key={invitation.id} className="space-y-2 border-b pb-4 last:border-0">
        <p className="break-words font-medium">{invitation.email}</p><p className="text-sm">{invitation.role} · {invitationStatus(invitation)}</p>
        <p className="text-sm text-muted-foreground">Expires <time dateTime={invitation.expires_at}>{new Date(invitation.expires_at).toLocaleString()}</time></p>
        {invitationStatus(invitation) === "pending" && <Button className="min-h-11" variant="outline" disabled={api.pending} onClick={() => { api.reset(); setRevoke(invitation); }}>Revoke</Button>}
      </li>)}</ul>}
    {revoke && <Confirmation title="Revoke invitation?" description={`Revoke the invitation for ${revoke.email}?`} pending={api.pending} onCancel={() => setRevoke(null)} onConfirm={async () => {
      if (api.pending) return;
      try { await api.revoke(revoke.id); setToken(""); } catch { /* Safe error is shown above. */ }
      setRevoke(null);
    }} />}
  </CardContent></Card>;
}
