import { ArrowRight, Compass, MapPin, Route, Sunrise } from "lucide-react";
import { AuthPanel } from "@/components/auth-panel";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <a href="#main" className="sr-only z-50 bg-white p-3 focus:not-sr-only focus:absolute">Skip to content</a>
      <header className="border-b bg-card">
        <nav aria-label="Main navigation" className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-4 md:px-6">
          <Link href="/" className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <Compass aria-hidden="true" className="size-7 text-primary" />Travel Planner
          </Link>
          <div className="flex items-center gap-6">
            <a href="#planning-tips" className="hidden min-h-11 items-center text-sm text-muted-foreground hover:text-foreground lg:inline-flex">Planning tips</a>
            <AuthPanel />
          </div>
        </nav>
      </header>
      <main id="main" className="flex-1">
        <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 md:px-6 md:py-16 lg:grid-cols-2 lg:gap-12">
          <div>
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-primary">A little planning. A world to explore.</p>
            <h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-tight md:text-5xl">Your next adventure, one day at a time.</h1>
            <p className="mt-6 max-w-md text-base leading-7 text-muted-foreground">Keep your places, plans, and people together. Choose a destination, build your itinerary, and leave a little room to wander.</p>
            <Button className="mt-8 w-full sm:w-auto" render={<Link href="/trips/new" />} nativeButton={false}>Plan a trip <ArrowRight aria-hidden="true" /></Button>
            <p className="mt-3 text-sm text-muted-foreground">Sign in to save your trip and plan together.</p>
          </div>
          <aside aria-label="Example day itinerary" className="rounded-2xl border bg-warmth p-2">
            <div className="mb-4 flex items-start p-4 justify-between gap-4">
              <div><p className="text-sm font-medium uppercase tracking-widest text-primary">A little inspiration</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">A day at your own pace</h2></div>
              <Sunrise aria-hidden="true" className="size-9 shrink-0 text-primary" />
            </div>
            <ol className="space-y-3">
              <li className="rounded-xl bg-card p-4 md:p-6"><p className="text-xs font-medium text-primary">MORNING</p><p className="mt-1 font-medium">Coffee & a slow start</p><p className="mt-1 text-sm text-muted-foreground">Find a local spot. Watch the city wake up.</p></li>
              <li className="rounded-xl bg-card p-4 md:p-6"><p className="text-xs font-medium text-primary">AFTERNOON</p><p className="mt-1 font-medium">Take the scenic route</p><p className="mt-1 text-sm text-muted-foreground">A neighborhood walk, with room to wander.</p></li>
              <li className="rounded-xl bg-card p-4 md:p-6"><p className="text-xs font-medium text-primary">EVENING</p><p className="mt-1 font-medium">One more good memory</p><p className="mt-1 text-sm text-muted-foreground">Sunset views and dinner with your people.</p></li>
            </ol>
            <p className="p-4 text-sm text-secondary-foreground">Just an example. The best itinerary feels like you.</p>
          </aside>
        </section>
        <section id="planning-tips" aria-labelledby="tips-heading" className="scroll-mt-8 border-t bg-card">
          <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Keep it simple</p>
            <h2 id="tips-heading" className="mt-3 text-xl md:text-2xl font-semibold tracking-tight">Good trips start with a few good ideas.</h2>
            <div className="mt-9 grid gap-8 sm:grid-cols-3">
              <article><MapPin aria-hidden="true" className="mb-4 size-6 text-primary" /><h3 className="font-semibold">Pick your place</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">A weekend nearby or somewhere entirely new. Start with where you want to go.</p></article>
              <article><Route aria-hidden="true" className="mb-4 size-6 text-primary" /><h3 className="font-semibold">Find your rhythm</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Choose a few must-sees, group nearby stops, and leave a little breathing room.</p></article>
              <article><Sunrise aria-hidden="true" className="mb-4 size-6 text-primary" /><h3 className="font-semibold">Leave room for discovery</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">You don’t need to fill every hour. Sometimes the unplanned moments are the best ones.</p></article>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-border px-4 py-6 text-center text-sm text-muted-foreground">Travel Planner · Make the journey your own.</footer>
    </div>
  );
}
