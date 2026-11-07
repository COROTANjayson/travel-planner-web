"use client";

import { useAuth0 } from "@auth0/auth0-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { AccountContent } from "@/components/features/account/account-content";
import { DesktopAccountNav } from "@/components/features/account/desktop-account-nav";
import { MobileBottomNav } from "@/components/features/account/mobile-bottom-nav";
import { SignedOutActions } from "@/components/features/account/signed-out-actions";
import { WorkspaceSidebar } from "@/components/features/account/workspace-sidebar";
import { type ApiUser, useApi } from "@/lib/api";

export function AuthPanel({
  mobile = false,
  sidebar = false,
}: {
  mobile?: boolean;
  sidebar?: boolean;
}) {
  const pathname = usePathname();
  const {
    error: authError,
    isAuthenticated,
    isLoading,
    loginWithRedirect,
    logout,
  } = useAuth0();
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

  if ((mobile || sidebar) && (isLoading || !isAuthenticated)) return null;

  if (isLoading) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Checking session…
      </p>
    );
  }

  if (!isAuthenticated) {
    return (
      <SignedOutActions
        authError={authError}
        actionError={actionError}
        signIn={signIn}
      />
    );
  }

  const name = user.data?.display_name.trim() || user.data?.email || "Traveler";

  const accountContent = (
    <AccountContent
      user={user}
      name={name}
      actionError={actionError}
      setActionError={setActionError}
      queryClient={queryClient}
      logout={logout}
    />
  );

  if (mobile)
    return (
      <MobileBottomNav pathname={pathname} accountContent={accountContent} />
    );

  if (sidebar)
    return (
      <WorkspaceSidebar pathname={pathname} accountContent={accountContent} />
    );

  return (
    <DesktopAccountNav pathname={pathname} accountContent={accountContent} />
  );
}
