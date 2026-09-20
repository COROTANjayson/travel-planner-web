"use client";

import { Auth0Provider } from "@auth0/auth0-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

const domain = process.env.NEXT_PUBLIC_AUTH0_DOMAIN;
const clientId = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID;
const audience = process.env.NEXT_PUBLIC_AUTH0_AUDIENCE;

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

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
      authorizationParams={{
        audience,
        redirect_uri: globalThis.location?.origin,
      }}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </Auth0Provider>
  );
}
