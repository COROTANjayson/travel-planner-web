"use client";

import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type ApiUser, useApi } from "@/lib/api";
import { useMembershipsApi } from "@/lib/memberships";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TripError } from "@/components/trips/trip-states";

export default function AcceptInvitationPage() {
  const request = useApi();
  const api = useMembershipsApi();
  const router = useRouter();
  const [token, setToken] = useState("");
  const me = useQuery({ queryKey: ["me"], queryFn: () => request<ApiUser>("/api/v1/me"), retry: false });
  const verified = me.isSuccess && !!me.data?.email && me.data.email_verified;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!verified || !token.trim() || api.pending) return;
    try {
      const participant = await api.accept(token);
      if (participant) { setToken(""); router.replace("/trips"); }
    } catch { /* Only the hook's sanitized message is rendered. */ }
  }
  return <>
    <h1 className="text-2xl font-semibold">Accept an invitation</h1>
    <p className="text-muted-foreground">Paste the invitation token shared with you by the trip owner.</p>
    {me.isPending ? <p role="status">Checking your email…</p> : me.isError ? <TripError error={me.error} retry={() => void me.refetch()} pending={me.isFetching} /> : !verified &&
      <p role="alert">Verify the matching email address in Auth0, then sign out and sign in again before accepting an invitation.</p>}
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <div className="space-y-2"><Label htmlFor="invitation-token">Invitation token</Label>
        <Input id="invitation-token" type="password" className="min-h-11" required autoComplete="off" autoCapitalize="none" spellCheck={false} value={token} disabled={api.pending} onChange={(event) => setToken(event.target.value)} />
      </div>
      {api.error && <TripError error={api.error} />}
      <Button type="submit" className="min-h-11" disabled={!verified || !token.trim() || api.pending}>{api.pending ? "Accepting…" : "Accept invitation"}</Button>
    </form>
  </>;
}
