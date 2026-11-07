"use client";

import Link from "next/link";

/** Query `view` value → tab label. The itinerary is the bare trip URL. */
export const tripViews: Record<string, string> = {
  "": "Itinerary",
  expenses: "Expenses",
  prep: "Prep",
};

export function TripViewSwitch({
  tripID,
  view,
}: {
  tripID: number;
  view: string;
}) {
  return (
    <nav aria-label="Trip views" className="trip-filters shrink-0 md:max-w-sm">
      {Object.entries(tripViews).map(([key, label]) => (
        <Link
          key={key}
          href={key ? `/trips/${tripID}?view=${key}` : `/trips/${tripID}`}
          scroll={false}
          className="trip-filter inline-flex items-center justify-center text-sm font-medium"
          aria-current={view === key ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
