import { Check, Coffee, MapPin, Sparkles, Utensils } from "lucide-react";

export function SampleItinerary() {
  return (
    <aside
      aria-label="Sample itinerary"
      className="sample-itinerary surface min-w-0 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-5">
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-primary">
          Sample itinerary
        </span>
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin aria-hidden="true" className="size-4" />
          Lisbon, Portugal
        </span>
      </div>
      <div className="py-5">
        <h2 className="text-2xl font-semibold tracking-tight">
          A day in Lisbon
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          3 activities. Plenty of room to explore.
        </p>
      </div>
      <ol className="space-y-3">
        {[
          {
            time: "9:00",
            title: "Coffee in the neighborhood",
            place: "A local cafe",
            category: "Rest",
            Icon: Coffee,
          },
          {
            time: "11:00",
            title: "Wander the old town",
            place: "Alfama",
            category: "Activity",
            Icon: Sparkles,
          },
          {
            time: "18:30",
            title: "Dinner together",
            place: "By the waterfront",
            category: "Eating",
            Icon: Utensils,
          },
        ].map((stop) => (
          <li
            key={stop.time}
            className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-3"
          >
            <span className="pt-4 text-xs tabular-nums text-muted-foreground">
              {stop.time}
            </span>
            <div className="rounded-xl border p-3">
              <span
                className="activity-category mb-2"
                data-category={stop.category}
              >
                <stop.Icon aria-hidden="true" className="size-3.5" />
                {stop.category}
              </span>
              <h3 className="font-semibold">{stop.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{stop.place}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-6 flex items-start gap-2 border-t pt-4 text-xs leading-5 text-muted-foreground">
        <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        Just an example. Your itinerary starts with your own ideas.
      </p>
    </aside>
  );
}
