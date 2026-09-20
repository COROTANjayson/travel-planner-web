import { ArrowDown, Compass, MapPin, Route, Sunrise } from "lucide-react";
import { AuthPanel } from "@/components/auth-panel";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-stone-50 text-stone-900">
      <a href="#main" className="sr-only z-50 bg-white p-3 focus:not-sr-only focus:absolute">Skip to content</a>
      <header className="border-b border-stone-200 bg-white">
        <nav aria-label="Main navigation" className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <Compass aria-hidden="true" className="size-7 text-teal-800" />Travel Planner
          </Link>
          <div className="flex items-center gap-6">
            <a href="#planning-tips" className="hidden text-sm text-stone-600 hover:text-stone-950 sm:inline">Planning tips</a>
            <AuthPanel />
          </div>
        </nav>
      </header>
      <main id="main" className="flex-1">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-teal-800">A little planning. A world to explore.</p>
            <h1 className="max-w-xl text-5xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">Your next adventure starts here.</h1>
            <p className="mt-6 max-w-md text-lg leading-8 text-stone-600">Make room for the places, people, and little detours that make a trip yours. Start with an idea. Take it one day at a time.</p>
            <a href="#planning-tips" className="mt-8 inline-flex min-h-11 items-center gap-3 rounded-lg bg-teal-900 px-5 py-3 text-sm font-medium text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-800">
              Find your starting point <ArrowDown aria-hidden="true" className="size-4" />
            </a>
          </div>
          <aside aria-label="Example day itinerary" className="rounded-3xl border border-teal-900/10 bg-teal-100/50 p-6 sm:p-10">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div><p className="text-xs font-medium uppercase tracking-widest text-teal-800">A little inspiration</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">A day at your own pace</h2></div>
              <Sunrise aria-hidden="true" className="size-9 shrink-0 text-teal-700" />
            </div>
            <ol className="space-y-3">
              <li className="rounded-xl bg-white p-5 shadow-sm"><p className="text-xs font-medium text-teal-800">MORNING</p><p className="mt-1 font-medium">Coffee & a slow start</p><p className="mt-1 text-sm text-stone-500">Find a local spot. Watch the city wake up.</p></li>
              <li className="rounded-xl bg-white p-5 shadow-sm"><p className="text-xs font-medium text-teal-800">AFTERNOON</p><p className="mt-1 font-medium">Take the scenic route</p><p className="mt-1 text-sm text-stone-500">A neighborhood walk, with room to wander.</p></li>
              <li className="rounded-xl bg-white p-5 shadow-sm"><p className="text-xs font-medium text-teal-800">EVENING</p><p className="mt-1 font-medium">One more good memory</p><p className="mt-1 text-sm text-stone-500">Sunset views and dinner with your people.</p></li>
            </ol>
            <p className="mt-5 text-xs text-teal-900/70">Just an example. The best itinerary feels like you.</p>
          </aside>
        </section>
        <section id="planning-tips" aria-labelledby="tips-heading" className="scroll-mt-8 border-t border-stone-200 bg-white">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-teal-800">Keep it simple</p>
            <h2 id="tips-heading" className="mt-3 text-3xl font-semibold tracking-tight">Good trips start with a few good ideas.</h2>
            <div className="mt-9 grid gap-8 sm:grid-cols-3">
              <article><MapPin aria-hidden="true" className="mb-4 size-6 text-teal-800" /><h3 className="font-semibold">Pick your place</h3><p className="mt-2 text-sm leading-6 text-stone-600">A weekend nearby or somewhere entirely new. Start with where you want to go.</p></article>
              <article><Route aria-hidden="true" className="mb-4 size-6 text-teal-800" /><h3 className="font-semibold">Find your rhythm</h3><p className="mt-2 text-sm leading-6 text-stone-600">Choose a few must-sees, group nearby stops, and leave a little breathing room.</p></article>
              <article><Sunrise aria-hidden="true" className="mb-4 size-6 text-teal-800" /><h3 className="font-semibold">Leave room for discovery</h3><p className="mt-2 text-sm leading-6 text-stone-600">You don’t need to fill every hour. Sometimes the unplanned moments are the best ones.</p></article>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-stone-200 px-5 py-6 text-center text-xs text-stone-500">Travel Planner · Make the journey your own.</footer>
    </div>
  );
}
