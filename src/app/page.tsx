import { ArrowRight, CalendarDays, Check, Compass, MapPin, Users } from "lucide-react";
import { AuthPanel } from "@/components/auth-panel";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="app-shell flex min-h-dvh flex-col bg-background text-foreground">
      <a href="#main" className="skip-link sr-only focus:not-sr-only">Skip to content</a>
      <header className="app-topbar border-b">
        <nav aria-label="Main navigation" className="content-shell flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
          <Link href="/" className="inline-flex min-h-12 items-center gap-2 font-semibold tracking-tight">
            <span className="brand-mark"><Compass aria-hidden="true" className="size-5" /></span>Travel Planner
          </Link>
          <AuthPanel />
        </nav>
      </header>
      <main id="main" className="flex-1" tabIndex={-1}>
        <section className="content-shell grid items-center gap-12 py-12 md:py-20 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:py-24">
          <div className="min-w-0">
            <p className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-primary"><Compass aria-hidden="true" className="size-4" />A little planning. More exploring.</p>
            <h1 className="max-w-xl text-[clamp(2.5rem,5vw,4rem)] leading-[1.08] font-semibold tracking-[-0.045em] text-balance">Good trips start with a simple plan.</h1>
            <p className="mt-6 max-w-md text-base leading-7 text-muted-foreground">Your places, daily plans, and travel companions, together in one clear itinerary. Make room for what matters along the way.</p>
            <Button className="mt-8 w-full px-6 sm:w-auto" render={<Link href="/trips/new" />} nativeButton={false}>Plan a trip <ArrowRight aria-hidden="true" /></Button>
            <p className="mt-4 text-sm text-muted-foreground">Sign in to save your plans and invite your people.</p>
          </div>
          <aside aria-label="Sample itinerary" className="surface min-w-0 p-5 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-5">
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-primary">Sample itinerary</span>
              <span className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin aria-hidden="true" className="size-4" />Lisbon, Portugal</span>
            </div>
            <div className="py-6"><p className="text-sm text-muted-foreground">A day to explore</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Take it at your own pace</h2></div>
            <ol className="space-y-3">
              {[
                { time: "9:00", title: "Coffee in the neighborhood", place: "A local cafe", detail: "A slow start and a good view." },
                { time: "11:00", title: "Wander the old town", place: "Alfama", detail: "A few favorite places, with time between." },
                { time: "18:30", title: "Dinner together", place: "By the waterfront", detail: "End the day with your people." },
              ].map((stop) => <li key={stop.time} className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-3">
                <span className="pt-4 text-xs tabular-nums text-muted-foreground">{stop.time}</span>
                <div className="rounded-xl border p-4"><h3 className="font-medium">{stop.title}</h3><p className="mt-1 text-sm text-muted-foreground">{stop.place}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{stop.detail}</p></div>
              </li>)}
            </ol>
            <p className="mt-6 flex items-start gap-2 border-t pt-4 text-xs leading-5 text-muted-foreground"><Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />Just an example. Your itinerary starts with your own ideas.</p>
          </aside>
        </section>
        <section aria-labelledby="planning-heading" className="border-t bg-card">
          <div className="content-shell py-12 md:py-16">
            <h2 id="planning-heading" className="text-2xl font-semibold tracking-tight md:text-3xl">Less to juggle. More to look forward to.</h2>
            <div className="mt-8 grid gap-8 md:grid-cols-3 md:gap-10">
              <article><span className="brand-mark mb-4"><MapPin aria-hidden="true" className="size-5" /></span><h3 className="font-semibold">Choose your destination</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Start with a place and dates. Keep your trip details easy to find.</p></article>
              <article><span className="brand-mark mb-4"><CalendarDays aria-hidden="true" className="size-5" /></span><h3 className="font-semibold">Plan one day at a time</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Add activities and places to a clear timeline, with room to change your mind.</p></article>
              <article><span className="brand-mark mb-4"><Users aria-hidden="true" className="size-5" /></span><h3 className="font-semibold">Bring your people</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Invite your travel companions and keep everyone on the same page.</p></article>
            </div>
          </div>
        </section>
      </main>
      <AuthPanel mobile />
      <footer className="content-shell py-6 text-sm text-muted-foreground">Travel Planner. A clear plan for the days ahead.</footer>
    </div>
  );
}
