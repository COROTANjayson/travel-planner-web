"use client";

import Link from "next/link";
import { useAuth0 } from "@auth0/auth0-react";
import { type ReactNode } from "react";
import { AuthPanel } from "@/components/auth-panel";

export default function TripsLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth0();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#trips-main" className="sr-only focus:not-sr-only focus:absolute focus:bg-background focus:p-3">
        Skip to content
      </a>
      <header className="border-b">
        <nav aria-label="Main navigation" className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="inline-flex min-h-11 items-center font-semibold">Travel Planner</Link>
          <AuthPanel />
        </nav>
      </header>
      <main id="trips-main" className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        {isLoading ? (
          <p role="status" className="text-muted-foreground">Checking session…</p>
        ) : isAuthenticated ? children : (
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Sign in to manage your trips</h1>
            <p className="text-muted-foreground">Use Log in or Sign up above to continue.</p>
          </div>
        )}
      </main>
    </div>
  );
}

