"use client";

import Link from "next/link";
import { useAuth0 } from "@auth0/auth0-react";
import { type ReactNode } from "react";
import { AuthPanel } from "@/components/auth-panel";
import { Compass } from "lucide-react";

export default function TripsLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth0();

  return (
    <div className="app-shell min-h-dvh bg-background text-foreground">
      <a href="#trips-main" className="sr-only focus:not-sr-only focus:absolute focus:bg-background focus:p-3">
        Skip to content
      </a>
      <header className="app-topbar sticky top-0 z-40 border-b border-border/70 bg-background md:static">
        <nav aria-label="Main navigation" className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 md:py-4 md:px-16">
          <Link href="/" className="inline-flex min-h-12 items-center gap-3 font-semibold tracking-tight"><span className="flex size-9 items-center justify-center rounded-xl bg-secondary"><Compass aria-hidden="true" className="size-5" /></span>Travel Planner</Link>
          <div className={isAuthenticated ? "hidden md:block" : ""}><AuthPanel /></div>
        </nav>
      </header>
      <main id="trips-main" className="mx-auto w-full max-w-[1440px] min-w-0 space-y-6 px-6 pt-8 pb-6 md:space-y-8 md:px-16 md:py-10">
        {isLoading ? (
          <p role="status" className="text-muted-foreground">Checking session…</p>
        ) : isAuthenticated ? children : (
          <div className="form-surface space-y-3">
            <p className="eyebrow">Your next chapter</p>
            <h1 className="page-title">Sign in to manage your trips</h1>
            <p className="text-muted-foreground">Use Log in or Sign up above to continue.</p>
          </div>
        )}
      </main>
      <AuthPanel mobile />
    </div>
  );
}
