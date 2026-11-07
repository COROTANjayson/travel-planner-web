import { ArrowRight, Compass } from "lucide-react";
import { AuthPanel } from "@/components/features/account/auth-panel";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlanningSteps } from "@/components/features/landing/planning-steps";
import { SampleItinerary } from "@/components/features/landing/sample-itinerary";

export default function Home() {
  return (
    <div className="app-shell flex min-h-dvh flex-col bg-background text-foreground">
      <a href="#main" className="skip-link sr-only focus:not-sr-only">
        Skip to content
      </a>
      <header className="app-topbar border-b">
        <nav
          aria-label="Main navigation"
          className="content-shell flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3"
        >
          <Link
            href="/"
            className="inline-flex min-h-12 items-center gap-2 font-semibold tracking-tight"
          >
            <span className="brand-mark">
              <Compass aria-hidden="true" className="size-5" />
            </span>
            Travel Planner
          </Link>
          <AuthPanel />
        </nav>
      </header>
      <main id="main" className="flex-1" tabIndex={-1}>
        <section className="content-shell landing-intro grid items-center gap-10 py-10 md:py-16 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
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
      <footer className="content-shell py-6 text-sm text-muted-foreground">
        Travel Planner. A clear plan for the days ahead.
      </footer>
    </div>
  );
}
