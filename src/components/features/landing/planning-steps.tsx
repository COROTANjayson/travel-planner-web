import { CalendarDays, MapPin, Users } from "lucide-react";

export function PlanningSteps() {
  return (
    <section aria-labelledby="planning-heading" className="border-t bg-card">
      <div className="content-shell py-10 md:py-12">
        <h2
          id="planning-heading"
          className="text-2xl font-semibold tracking-tight md:text-3xl"
        >
          Less to juggle. More to look forward to.
        </h2>
        <div className="planning-steps mt-7 grid gap-6 md:grid-cols-3 md:gap-8">
          <article>
            <h3 className="flex items-center gap-2 font-semibold">
              <MapPin aria-hidden="true" className="size-4 text-primary" />
              Choose your destination
            </h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              Start with a place and dates. Keep your trip details easy to find.
            </p>
          </article>
          <article>
            <h3 className="flex items-center gap-2 font-semibold">
              <CalendarDays
                aria-hidden="true"
                className="size-4 text-primary"
              />
              Plan one day at a time
            </h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              Add activities and places to a clear timeline, with room to change
              your mind.
            </p>
          </article>
          <article>
            <h3 className="flex items-center gap-2 font-semibold">
              <Users aria-hidden="true" className="size-4 text-primary" />
              Bring your people
            </h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              Invite your travel companions and keep everyone on the same page.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
