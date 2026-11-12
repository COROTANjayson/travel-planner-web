import { Check, Coffee, MapPin, Sparkles, Utensils } from "lucide-react";

export function SampleItinerary() {
  return (
    <aside
      aria-label="Sample itinerary"
      className="sample-itinerary surface border border-border rounded-2xl bg-card min-w-0 p-5 sm:p-6 [&]:[border-top:3px_solid_var(--primary)]"
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
                className="activity-category [display:inline-flex] [max-width:100%] [align-items:center] [gap:0.375rem] [border-radius:9999px] [background:var(--muted)] [color:var(--muted-foreground)] [padding:0.125rem_0.625rem] [font-size:0.75rem] [line-height:1.25rem] [font-weight:500] mb-2 [&[data-icon-only]]:[width:2.75rem] [&[data-icon-only]]:[height:2.75rem] [&[data-icon-only]]:[flex-shrink:0] [&[data-icon-only]]:[justify-content:center] [&[data-icon-only]]:[border-radius:0.75rem] [&[data-icon-only]]:[padding:0] [&[data-icon-only]_svg]:[width:1.25rem] [&[data-icon-only]_svg]:[height:1.25rem] [&[data-category='Rest']]:[background:#f0ebfa] [&[data-category='Rest']]:[color:#65438b] [&[data-category='Eating']]:[background:#fff0e2] [&[data-category='Eating']]:[color:#945020] [&[data-category='Travel']]:[background:#e8f0ff] [&[data-category='Travel']]:[color:#315da3] [&[data-category='Activity']]:[background:#e6f4ec] [&[data-category='Activity']]:[color:#316747]"
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
