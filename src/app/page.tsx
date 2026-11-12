import { ArrowRight, Compass } from "lucide-react";
import { AuthPanel } from "@/components/features/account/auth-panel";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlanningSteps } from "@/components/features/landing/planning-steps";
import { SampleItinerary } from "@/components/features/landing/sample-itinerary";

export default function Home() {
  return (
    <div className="app-shell flex min-h-dvh flex-col bg-background text-foreground [&]:[--app-top:calc(56px_+_env(safe-area-inset-top,_0px))] [&]:[--app-bottom:calc(6rem_+_env(safe-area-inset-bottom,_0px))] [&:has(.trip-detail)_>_main#trips-main]:[padding-top:1rem] max-md:[&:has(.trips-overview)_>_.content-shell]:[padding-inline:max(1.25rem,_env(safe-area-inset-left,_0px))_max(1.25rem,_env(safe-area-inset-right,_0px))] max-md:[&:has(.mobile-trip-header)_>_.app-topbar]:[visibility:hidden] max-md:[&:has(.mobile-bottom-nav)_>_footer]:[padding-bottom:calc(var(--app-bottom)_+_24px)] max-md:[&_>_main#trips-main]:[padding-bottom:calc(var(--app-bottom)_+_24px)] max-md:[&:has(.mobile-add-activity)_>_main#trips-main]:[padding-bottom:calc(var(--app-bottom)_+_72px)] max-md:[&_.form-actions]:[bottom:var(--app-bottom)] max-md:[&_.form-surface]:[border:0] max-md:[&_.form-surface]:[border-radius:0] max-md:[&_.form-surface]:[background:transparent] max-md:[&_.form-surface]:[padding:0] max-md:[&_.form-surface]:[--form-surface:var(--background)] md:[&:has(.trip-detail)_>_main#trips-main]:[padding-top:0.5rem] lg:[&[data-authenticated='true']]:[padding-left:236px] lg:[&[data-authenticated='true']_>_.app-topbar]:[display:none] lg:[&[data-authenticated='true']_>_.content-shell]:[padding:2rem_2.5rem] max-[360px]:[&:has(.trips-overview)_>_.content-shell]:[padding-inline:1rem] max-md:[&:has(.trip-expenses-page)_>_main#trips-main]:[padding-inline:max(12px,_env(safe-area-inset-left,_0px))_max(12px,_env(safe-area-inset-right,_0px))] max-md:[&:has(.trip-expenses-page)_>_main#trips-main]:[padding-top:12px]">
      <a
        href="#main"
        className="skip-link fixed top-2 left-2 z-60 rounded-xl bg-card px-4 py-3 sr-only focus:not-sr-only"
      >
        Skip to content
      </a>
      <header className="app-topbar bg-background border-b max-md:pt-[env(safe-area-inset-top,0px)]">
        <nav
          aria-label="Main navigation"
          className="content-shell w-full max-w-[90rem] mx-auto px-[max(1.5rem,env(safe-area-inset-left,0px))] [padding-right:max(1.5rem,env(safe-area-inset-right,0px))] flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 max-md:min-h-14 md:[&]:[padding-left:max(2rem,_env(safe-area-inset-left,_0px))] md:[&]:[padding-right:max(2rem,_env(safe-area-inset-right,_0px))] xl:[&]:[padding-left:max(4rem,_env(safe-area-inset-left,_0px))] xl:[&]:[padding-right:max(4rem,_env(safe-area-inset-right,_0px))]"
        >
          <Link
            href="/"
            className="inline-flex min-h-12 items-center gap-2 font-semibold tracking-tight"
          >
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-[var(--ocean)] text-white">
              <Compass aria-hidden="true" className="size-5" />
            </span>
            Travel Planner
          </Link>
          <AuthPanel />
        </nav>
      </header>
      <main id="main" className="flex-1" tabIndex={-1}>
        <section className="content-shell w-full max-w-[90rem] mx-auto px-[max(1.5rem,env(safe-area-inset-left,0px))] [padding-right:max(1.5rem,env(safe-area-inset-right,0px))] landing-intro grid items-center gap-10 py-10 md:py-16 lg:grid-cols-[1.1fr_1fr] lg:gap-14 md:[&]:[padding-left:max(2rem,_env(safe-area-inset-left,_0px))] md:[&]:[padding-right:max(2rem,_env(safe-area-inset-right,_0px))] xl:[&]:[padding-left:max(4rem,_env(safe-area-inset-left,_0px))] xl:[&]:[padding-right:max(4rem,_env(safe-area-inset-right,_0px))]">
          <div className="min-w-0">
            <h1 className="max-w-xl text-[clamp(2.5rem,5vw,4rem)] leading-[1.08] font-semibold tracking-[-0.035em] text-balance">
              Good trips start with a{" "}
              <span className="text-primary">simple plan.</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-muted-foreground">
              Your places, daily plans, and travel companions, together in one
              clear itinerary. Make room for what matters along the way.
            </p>
            <Button
              className="mt-8 w-full px-6 sm:w-auto"
              render={<Link href="/trips/new" />}
              nativeButton={false}
            >
              Plan a trip <ArrowRight aria-hidden="true" />
            </Button>
            <p className="mt-4 text-sm text-muted-foreground">
              Sign in to save your plans and invite your people.
            </p>
          </div>
          <SampleItinerary />
        </section>
        <PlanningSteps />
      </main>
      <AuthPanel mobile />
      <footer className="content-shell w-full max-w-[90rem] mx-auto px-[max(1.5rem,env(safe-area-inset-left,0px))] [padding-right:max(1.5rem,env(safe-area-inset-right,0px))] py-6 text-sm text-muted-foreground md:[&]:[padding-left:max(2rem,_env(safe-area-inset-left,_0px))] md:[&]:[padding-right:max(2rem,_env(safe-area-inset-right,_0px))] xl:[&]:[padding-left:max(4rem,_env(safe-area-inset-left,_0px))] xl:[&]:[padding-right:max(4rem,_env(safe-area-inset-right,_0px))]">
        Travel Planner. A clear plan for the days ahead.
      </footer>
    </div>
  );
}
