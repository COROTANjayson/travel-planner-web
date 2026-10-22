"use client";

import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

const domain = process.env.NEXT_PUBLIC_AUTH0_DOMAIN;
const clientId = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID;
const audience = process.env.NEXT_PUBLIC_AUTH0_AUDIENCE;

function SessionRecovery({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, error, loginWithRedirect } = useAuth0();
  // Capture the SDK's session hint before a failed iframe check clears it.
  const [hadSession] = useState(() => typeof document !== "undefined" &&
    document.cookie.split(";").some((cookie) => cookie.trim() === `auth0.${clientId}.is.authenticated=true`));
  const checked = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (isLoading || checked.current) return;
    checked.current = true;
    if (!hadSession || isAuthenticated || error) return;

    // A top-level redirect can reuse Auth0 cookies blocked inside an iframe.
    void loginWithRedirect({
      appState: { returnTo: window.location.pathname + window.location.search + window.location.hash },
    }).catch(() => setFailed(true));
  }, [isLoading, isAuthenticated, error, hadSession, loginWithRedirect]);

  return <>
    {failed && <p role="alert" className="p-6 text-sm text-destructive">Unable to restore your session. Please use Log in to try again.</p>}
    {children}
  </>;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const router = useRouter();

  if (!domain || !clientId || !audience) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <p role="alert" className="max-w-md text-center text-sm text-destructive">
          Authentication is not configured. Set the three NEXT_PUBLIC_AUTH0
          environment variables and restart the app.
        </p>
      </main>
    );
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      cacheLocation="memory"
      onRedirectCallback={(appState) => {
        const path = appState?.returnTo;
        router.replace(typeof path === "string" && path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") ? path : "/");
      }}
      authorizationParams={{
        audience,
        redirect_uri: globalThis.location?.origin,
      }}
    >
      <QueryClientProvider client={queryClient}><SessionRecovery>{children}</SessionRecovery></QueryClientProvider>
    </Auth0Provider>
  );
}
