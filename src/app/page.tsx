import { ArrowRight, Coffee, Compass, MapPin, Route, Sunrise, Utensils } from "lucide-react";
import Image from "next/image";
import { AuthPanel } from "@/components/auth-panel";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <a href="#main" className="sr-only z-50 bg-white p-3 focus:not-sr-only focus:absolute">Skip to content</a>
      <header className="border-b border-border/70">
        <nav aria-label="Main navigation" className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-4 gap-y-3 px-6 py-4 lg:px-16">
          <Link href="/" className="inline-flex min-h-12 items-center gap-3 text-base font-semibold tracking-tight">
            <span className="flex size-9 items-center justify-center rounded-xl bg-secondary"><Compass aria-hidden="true" className="size-5" /></span>Travel Planner
          </Link>
          <div className="flex items-center gap-6">
            <a href="#planning-tips" className="hidden min-h-11 items-center text-sm text-muted-foreground hover:text-foreground lg:inline-flex">Planning tips</a>
            <AuthPanel />
          </div>
        </nav>
      </header>
      <main id="main" className="flex-1">
        <section className="mx-auto grid max-w-[1440px] items-center gap-12 px-6 py-12 md:py-20 lg:grid-cols-2 lg:gap-16 lg:px-16 lg:py-24">
          <div className="min-w-0">
            <p className="eyebrow mb-5">A little planning. A world to explore.</p>
            <h1 className="max-w-xl font-heading text-[clamp(2.5rem,5vw,4.5rem)] leading-[1.1] tracking-[-0.04em] text-balance">Your next adventure, <span className="italic">one day at a time.</span></h1>
            <p className="mt-6 max-w-md text-base leading-7 text-muted-foreground">Keep your places, plans, and people together. Choose a destination, build your itinerary, and leave a little room to wander.</p>
            <Button className="journey-accent mt-8 min-h-12 w-full px-6 sm:w-auto" render={<Link href="/trips/new" />} nativeButton={false}>Plan a trip <ArrowRight aria-hidden="true" /></Button>
            <p className="mt-4 text-sm text-muted-foreground">Sign in to save your trip and plan together.</p>
          </div>
          <aside aria-label="Example day itinerary" className="overflow-hidden rounded-3xl border bg-card p-2 shadow-[0_12px_48px_-24px_#29243d26]">
            <div className="relative h-44 overflow-hidden rounded-2xl bg-secondary sm:h-52"><Image src="/illustrations/journey-cover.svg" alt="" fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" /></div>
            <div className="p-4 sm:p-6">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div><p className="eyebrow">A little inspiration</p><h2 className="mt-2 font-heading text-2xl tracking-tight">A day at your own pace</h2></div>
                <Sunrise aria-hidden="true" className="mt-1 size-6 shrink-0 text-muted-foreground" />
              </div>
              <ol className="divide-y divide-border/70">
                <li className="flex gap-4 pb-4"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted"><Coffee aria-hidden="true" className="size-4" /></span><div><p className="eyebrow">Morning</p><p className="mt-1 font-medium">Coffee & a slow start</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Find a local spot. Watch the city wake up.</p></div></li>
                <li className="flex gap-4 py-4"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary"><Route aria-hidden="true" className="size-4" /></span><div><p className="eyebrow">Afternoon</p><p className="mt-1 font-medium">Take the scenic route</p><p className="mt-1 text-sm leading-6 text-muted-foreground">A neighborhood walk, with room to wander.</p></div></li>
                <li className="flex gap-4 pt-4"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted"><Utensils aria-hidden="true" className="size-4" /></span><div><p className="eyebrow">Evening</p><p className="mt-1 font-medium">One more good memory</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Sunset views and dinner with your people.</p></div></li>
              </ol>
              <p className="mt-6 border-t pt-4 text-xs leading-5 text-muted-foreground">Just an example. The best itinerary feels like you.</p>
            </div>
          </aside>
        </section>
        <section id="planning-tips" aria-labelledby="tips-heading" className="scroll-mt-8 border-t">
          <div className="mx-auto max-w-[1440px] px-6 py-14 lg:px-16 lg:py-20">
            <p className="eyebrow">Keep it simple</p>
            <h2 id="tips-heading" className="mt-3 max-w-xl font-heading text-3xl leading-tight tracking-tight text-balance md:text-4xl">Good trips start with a few good ideas.</h2>
            <div className="mt-10 grid gap-8 md:grid-cols-3 md:gap-12">
              <article><MapPin aria-hidden="true" className="mb-5 size-6 text-primary" /><h3 className="font-semibold">Pick your place</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">A weekend nearby or somewhere entirely new. Start with where you want to go.</p></article>
              <article><Route aria-hidden="true" className="mb-5 size-6 text-primary" /><h3 className="font-semibold">Find your rhythm</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Choose a few must-sees, group nearby stops, and leave a little breathing room.</p></article>
              <article><Sunrise aria-hidden="true" className="mb-5 size-6 text-primary" /><h3 className="font-semibold">Leave room for discovery</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">You don’t need to fill every hour. Sometimes the unplanned moments are the best ones.</p></article>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-border px-4 py-6 text-center text-sm text-muted-foreground">Travel Planner · Make the journey your own.</footer>
    </div>
  );
}
