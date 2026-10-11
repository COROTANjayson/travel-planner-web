"use client";

import Link from "next/link";
import { useAuth0 } from "@auth0/auth0-react";
import { type ReactNode } from "react";
import { AuthPanel } from "@/components/auth-panel";

export default function TripsLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth0();

  return (
    <div className="app-shell min-h-dvh bg-background text-foreground">
      <a href="#trips-main" className="sr-only focus:not-sr-only focus:absolute focus:bg-background focus:p-3">
        Skip to content
      </a>
      <header className="app-topbar sticky top-0 z-40 border-b bg-background md:static">
        <nav aria-label="Main navigation" className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 md:py-4 md:px-6">
          <Link href="/" className="inline-flex min-h-11 items-center font-semibold">Travel Planner</Link>
          <div className={isAuthenticated ? "hidden md:block" : ""}><AuthPanel /></div>
        </nav>
      </header>
      <main id="trips-main" className="mx-auto w-full max-w-6xl min-w-0 space-y-5 px-4 pt-4 pb-6 md:space-y-6 md:px-6 md:py-8">
        {isLoading ? (
          <p role="status" className="text-muted-foreground">Checking session…</p>
        ) : isAuthenticated ? children : (
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Sign in to manage your trips</h1>
            <p className="text-muted-foreground">Use Log in or Sign up above to continue.</p>
          </div>
        )}
      </main>
      <AuthPanel mobile />
    </div>
  );
}
