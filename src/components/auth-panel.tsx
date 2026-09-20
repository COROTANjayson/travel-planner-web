"use client";

import { useAuth0 } from "@auth0/auth0-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, UserRound } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ApiError, type ApiUser, useApi } from "@/lib/api";

export function AuthPanel() {
  const { error: authError, isAuthenticated, isLoading, loginWithRedirect, logout } = useAuth0();
  const [actionError, setActionError] = useState<string>();
  const queryClient = useQueryClient();
  const api = useApi();
  const user = useQuery({
    queryKey: ["me"],
    queryFn: () => api<ApiUser>("/api/v1/me"),
    enabled: isAuthenticated,
    retry: false,
  });

  async function signIn(signUp = false) {
    setActionError(undefined);
    try {
      await loginWithRedirect({
        appState: { returnTo: window.location.pathname },
        ...(signUp ? { authorizationParams: { screen_hint: "signup" } } : {}),
      });
    } catch {
      setActionError("Unable to sign in. Please try again.");
    }
  }

  if (isLoading) {
    return <p role="status" className="text-sm text-muted-foreground">Checking session…</p>;
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {(authError || actionError) && (
          <p role="alert" className="max-w-60 text-sm text-destructive">
            {actionError || "Authentication is unavailable. Please try again."}
          </p>
        )}
        <Button variant="ghost" className="h-10 px-4" onClick={() => void signIn()}>Log in</Button>
        <Button className="h-10 px-4" onClick={() => void signIn(true)}>Sign up</Button>
      </div>
    );
  }

  const name = user.data?.display_name.trim() || user.data?.email || "Traveler";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="ghost" className="min-h-11" render={<Link href="/trips" />} nativeButton={false}>Trips</Button>
      <details className="group relative">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-3 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-4 [&::-webkit-details-marker]:hidden">
        <UserRound aria-hidden="true" className="size-4" />
        My account
        <ChevronDown aria-hidden="true" className="size-4 group-open:rotate-180" />
      </summary>
      <div className="absolute right-0 z-20 mt-3 w-72 max-w-[calc(100vw-2rem)] space-y-4 rounded-xl border bg-card p-5 shadow-lg">
        {user.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">Loading your profile…</p>
        ) : user.isError ? (
          <div className="space-y-3">
            <p role="alert" className="text-sm text-destructive">
              {user.error instanceof ApiError ? user.error.message : "Could not load your profile. Please try again."}
            </p>
            <Button variant="outline" disabled={user.isFetching} onClick={() => void user.refetch()}>Try again</Button>
          </div>
        ) : (
          <div className="space-y-1 break-words">
            <p className="text-xs text-muted-foreground">Welcome back</p>
            <p className="font-semibold">{name}</p>
            <p className="text-sm text-muted-foreground">{user.data?.email || "No email provided"}</p>
          </div>
        )}
        {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
        <Button variant="outline" className="h-10 w-full" onClick={async () => {
          setActionError(undefined);
          try {
            queryClient.clear();
            await logout({ logoutParams: { returnTo: window.location.origin } });
          } catch {
            setActionError("Unable to log out. Please try again.");
          }
        }}>Log out</Button>
      </div>
      </details>
    </div>
  );
}
