"use client";

import { useAuth0 } from "@auth0/auth0-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, UserRound, Briefcase, Mail } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TripDialog } from "@/components/trips/trip-dialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { ApiError, type ApiUser, useApi } from "@/lib/api";

export function AuthPanel({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
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

  if (mobile && (isLoading || !isAuthenticated)) return null;

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

  const accountContent = <>
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
  </>;

  if (mobile) return <nav aria-label="Mobile navigation" className="mobile-bottom-nav fixed z-40 grid grid-cols-3 md:hidden">
    <Link href="/trips" aria-current={pathname.startsWith("/trips") ? "page" : undefined} className="mobile-nav-item"><span className="mobile-nav-icon"><Briefcase aria-hidden="true" className="size-5" /></span><span>Trips</span></Link>
    <Link href="/invitations/accept" aria-current={pathname.startsWith("/invitations") ? "page" : undefined} className="mobile-nav-item"><span className="mobile-nav-icon"><Mail aria-hidden="true" className="size-5" /></span><span>Invitations</span></Link>
    <TripDialog title="My account" description="Your traveler profile and session." mobilePresentation="sheet"
      trigger={<button type="button" className="mobile-nav-item"><span className="mobile-nav-icon"><UserRound aria-hidden="true" className="size-5" /></span><span>Account</span></button>}>
      <div className="space-y-5">{accountContent}</div>
    </TripDialog>
  </nav>;

  return (
    <div className="hidden flex-wrap items-center gap-1 md:flex">
      <Button variant="ghost" className="min-h-11" aria-current={pathname.startsWith("/trips") ? "page" : undefined} render={<Link href="/trips" />} nativeButton={false}>Trips</Button>
      <Button variant="ghost" className="min-h-11" aria-current={pathname.startsWith("/invitations") ? "page" : undefined} render={<Link href="/invitations/accept" />} nativeButton={false}>Invitations</Button>
      <Popover>
      <PopoverTrigger render={<Button variant="ghost" className="min-h-11" />}>
        <UserRound aria-hidden="true" className="size-4" />
        My account
        <ChevronDown aria-hidden="true" className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-72 max-w-[calc(100vw-3rem)] gap-4 border p-5">
        <PopoverTitle className="sr-only">My account</PopoverTitle>
        {accountContent}
      </PopoverContent>
      </Popover>
    </div>
  );
}
