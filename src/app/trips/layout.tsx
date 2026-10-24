"use client";

import Link from "next/link";
import { useAuth0 } from "@auth0/auth0-react";
import { type ReactNode } from "react";
import { AuthPanel } from "@/components/auth-panel";
import { Compass } from "lucide-react";

export default function TripsLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth0();

  return (
    <div className="app-shell flex min-h-dvh flex-col bg-background text-foreground">
      <a href="#trips-main" className="skip-link sr-only focus:not-sr-only">
        Skip to content
      </a>
      <header className="app-topbar sticky top-0 z-40 border-b border-border md:static">
        <nav
          aria-label="Main navigation"
          className="content-shell flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-1 md:py-3"
        >
          <Link
            href={isAuthenticated ? "/trips" : "/"}
            aria-label="Travel Planner home"
            className="inline-flex min-h-12 items-center gap-2 font-semibold tracking-tight"
          >
            <span className="brand-mark shrink-0">
              <Compass aria-hidden="true" className="size-5" />
            </span>
            Travel Planner
          </Link>
          <div className={isAuthenticated ? "hidden md:block" : ""}>
            <AuthPanel />
          </div>
        </nav>
      </header>
      <main
        id="trips-main"
        className="content-shell min-w-0 flex-1 space-y-5 pt-6 pb-6 md:space-y-6 md:py-8"
        tabIndex={-1}
      >
        {isLoading ? (
          <p role="status" className="text-muted-foreground">
            Checking session…
          </p>
        ) : isAuthenticated ? (
          children
        ) : (
          <div className="form-surface space-y-3">
            <h1 className="page-title">Sign in to manage your trips</h1>
            <p className="text-muted-foreground">
              Use Log in or Sign up above to continue.
            </p>
          </div>
        )}
      </main>
      <AuthPanel mobile />
    </div>
  );
}
