"use client";

import Link from "next/link";
import { useAuth0 } from "@auth0/auth0-react";
import { type ReactNode } from "react";
import { AuthPanel } from "@/components/features/account/auth-panel";
import { Compass } from "lucide-react";

export default function TripsLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth0();

  return (
    <div
      className="app-shell flex min-h-dvh flex-col bg-background text-foreground [&]:[--app-top:calc(56px_+_env(safe-area-inset-top,_0px))] [&]:[--app-bottom:calc(6rem_+_env(safe-area-inset-bottom,_0px))] [&:has(.trip-detail)_>_main#trips-main]:[padding-top:1rem] max-md:[&:has(.trips-overview)_>_.content-shell]:[padding-inline:max(1.25rem,_env(safe-area-inset-left,_0px))_max(1.25rem,_env(safe-area-inset-right,_0px))] max-md:[&:has(.mobile-trip-header)_>_.app-topbar]:[visibility:hidden] max-md:[&:has(.mobile-bottom-nav)_>_footer]:[padding-bottom:calc(var(--app-bottom)_+_24px)] max-md:[&_>_main#trips-main]:[padding-bottom:calc(var(--app-bottom)_+_24px)] max-md:[&:has(.mobile-add-activity)_>_main#trips-main]:[padding-bottom:calc(var(--app-bottom)_+_72px)] max-md:[&_.form-actions]:[bottom:var(--app-bottom)] max-md:[&_.form-surface]:[border:0] max-md:[&_.form-surface]:[border-radius:0] max-md:[&_.form-surface]:[background:transparent] max-md:[&_.form-surface]:[padding:0] max-md:[&_.form-surface]:[--form-surface:var(--background)] md:[&:has(.trip-detail)_>_main#trips-main]:[padding-top:0.5rem] lg:[&[data-authenticated='true']]:[padding-left:236px] lg:[&[data-authenticated='true']_>_.app-topbar]:[display:none] lg:[&[data-authenticated='true']_>_.content-shell]:[padding:2rem_2.5rem] max-[360px]:[&:has(.trips-overview)_>_.content-shell]:[padding-inline:1rem] max-md:[&:has(.trip-expenses-page)_>_main#trips-main]:[padding-inline:max(12px,_env(safe-area-inset-left,_0px))_max(12px,_env(safe-area-inset-right,_0px))] max-md:[&:has(.trip-expenses-page)_>_main#trips-main]:[padding-top:12px]"
      data-authenticated={isAuthenticated}
    >
      <a
        href="#trips-main"
        className="skip-link fixed top-2 left-2 z-60 rounded-xl bg-card px-4 py-3 sr-only focus:not-sr-only"
      >
        Skip to content
      </a>
      {isAuthenticated && <AuthPanel sidebar />}
      <header className="app-topbar bg-background sticky top-0 z-40 border-b border-border max-md:pt-[env(safe-area-inset-top,0px)] md:static">
        <nav
          aria-label="Main navigation"
          className="content-shell w-full max-w-[90rem] mx-auto px-[max(1.5rem,env(safe-area-inset-left,0px))] [padding-right:max(1.5rem,env(safe-area-inset-right,0px))] flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-1 max-md:min-h-14 md:py-3 md:[&]:[padding-left:max(2rem,_env(safe-area-inset-left,_0px))] md:[&]:[padding-right:max(2rem,_env(safe-area-inset-right,_0px))] xl:[&]:[padding-left:max(4rem,_env(safe-area-inset-left,_0px))] xl:[&]:[padding-right:max(4rem,_env(safe-area-inset-right,_0px))]"
        >
          <Link
            href={isAuthenticated ? "/trips" : "/"}
            aria-label="Travel Planner home"
            className="inline-flex min-h-12 items-center gap-2 font-semibold tracking-tight"
          >
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--ocean)] text-white">
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
        className="content-shell w-full max-w-[90rem] mx-auto px-[max(1.5rem,env(safe-area-inset-left,0px))] [padding-right:max(1.5rem,env(safe-area-inset-right,0px))] min-w-0 flex-1 space-y-5 pt-6 pb-6 md:space-y-6 md:py-8 md:[&]:[padding-left:max(2rem,_env(safe-area-inset-left,_0px))] md:[&]:[padding-right:max(2rem,_env(safe-area-inset-right,_0px))] xl:[&]:[padding-left:max(4rem,_env(safe-area-inset-left,_0px))] xl:[&]:[padding-right:max(4rem,_env(safe-area-inset-right,_0px))]"
        tabIndex={-1}
      >
        {isLoading ? (
          <p role="status" className="text-muted-foreground">
            Checking session…
          </p>
        ) : isAuthenticated ? (
          children
        ) : (
          <div className="form-surface [--form-surface:var(--card)] mx-auto w-full max-w-[44rem] rounded-2xl border border-border bg-card p-8 space-y-3">
            <h1 className="page-title text-3xl font-[650] leading-[1.2] tracking-[-0.03em] text-balance md:[&]:[font-size:2.25rem]">
              Sign in to manage your trips
            </h1>
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
