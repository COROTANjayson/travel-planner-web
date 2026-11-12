"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight, MapPin } from "lucide-react";
import {
  formatTripDates,
  tripDayCount,
  tripStatus,
  type Trip,
} from "@/lib/trips";
import { cn } from "@/lib/utils";

const toneBg = {
  sea: "bg-[var(--trip-sea)]",
  mist: "bg-[var(--trip-mist)]",
  sand: "bg-[var(--trip-sand)]",
};

export function TripCard({
  trip,
  featuredID,
}: {
  trip: Trip;
  featuredID?: number;
}) {
  const status = tripStatus(trip.start_date, trip.end_date, trip.time_zone);
  const featured = trip.id === featuredID;
  const past = status === "Past";
  const tone =
    status === "Ongoing" ? "sea" : trip.id % 2 === 0 ? "sand" : "mist";
  const days = tripDayCount(trip.start_date, trip.end_date);
  const dayLabel = days === 1 ? "day" : "days";

  return (
    <Link
      href={`/trips/${trip.id}`}
      className={cn(
        "group/card relative isolate flex min-w-0 flex-col gap-7 rounded-3xl border border-transparent p-6 text-foreground no-underline transition-[border-color] duration-150 ease-out",
        "before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:rounded-[inherit] before:bg-[url('/coastal/journey.svg')] before:bg-[position:right_-80px_top_-28px] before:bg-no-repeat before:[background-size:260px_200px] before:opacity-[0.38] before:content-['']",
        "hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-ring",
        "lg:min-h-[15.75rem] lg:px-7 lg:py-6 [@media(width<360px)]:p-5",
        featured
          ? "lg:col-span-full lg:min-h-[17.5rem] lg:p-7 lg:before:[background-position:right_105px_top_-23px] lg:before:[background-size:410px_290px]"
          : "",
        past
          ? "min-h-0 gap-4 border-border bg-background before:hidden lg:col-span-full lg:grid lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,auto)] lg:items-center lg:gap-8 lg:py-5"
          : toneBg[featured ? "sea" : tone],
      )}
      data-featured={featured || undefined}
      aria-labelledby={`trip-${trip.id}-name`}
    >
      <div
        className={cn(
          "min-w-0",
          past &&
            "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2",
          featured && "lg:w-[calc(100%-225px)]",
        )}
      >
        <div
          className={cn(
            "mb-6 flex items-center justify-between gap-4 text-muted-foreground",
            past && "col-start-2 row-[1/3] m-0 justify-end [&>svg]:hidden",
          )}
        >
          <MapPin aria-hidden="true" className="size-4" />
          <span
            className={cn(
              "inline-flex w-fit items-center rounded-full px-3 py-1 text-xs leading-5 font-semibold whitespace-nowrap",
              past
                ? "bg-[#e9ede8] text-[#526258]"
                : featured || status === "Ongoing"
                  ? "bg-[#1c6465] text-white"
                  : tone === "sand"
                    ? "bg-[#e5ddbf] text-[#625333]"
                    : "bg-[#d9e3e9] text-[#405a69]",
            )}
          >
            {status}
          </span>
        </div>
        <p
          className={cn(
            "mb-3 text-[clamp(1.625rem,2.5vw,2rem)] leading-[1.2] tracking-[-0.035em] font-semibold",
            past && "m-0 text-[1.375rem]",
            featured && "lg:text-[clamp(2rem,3.3vw,3rem)]",
          )}
        >
          {trip.destination}
        </p>
        <h2
          id={`trip-${trip.id}-name`}
          className="m-0 text-[0.9375rem] leading-[1.6] font-normal tracking-normal text-muted-foreground group-hover/card:text-primary"
        >
          {trip.name}
        </h2>
      </div>
      <div
        className={cn(
          "mt-auto flex min-w-0 items-center justify-between gap-4 border-t border-[#c9dbd0] pt-5",
          past && "lg:m-0 lg:border-0 lg:p-0",
          featured && "lg:w-[calc(100%-225px)]",
        )}
      >
        <div className="min-w-0">
          <p className="flex items-start gap-2 text-[0.8125rem] leading-[1.6] font-semibold">
            <CalendarDays
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            <span>
              {formatTripDates(trip.start_date, trip.end_date)} · {days}{" "}
              {dayLabel}
            </span>
          </p>
          <p className="mt-1.5 ml-6 text-[0.6875rem] text-muted-foreground">
            Time zone: {trip.time_zone}
          </p>
        </div>
        <span
          className={cn(
            "grid size-11 flex-none place-items-center rounded-full",
            featured
              ? "bg-[var(--ocean)] text-white"
              : cn(
                  "text-[var(--ocean)]",
                  tone === "mist" ? "bg-[#d9e3e9]" : "bg-[#e5eadc]",
                ),
          )}
        >
          <span className="sr-only">View trip</span>
          <ChevronRight aria-hidden="true" className="size-[1.125rem]" />
        </span>
      </div>
      {featured && (
        <div
          className="absolute inset-[1.75rem_1.75rem_1.5rem_auto] hidden w-[195px] items-center justify-center gap-5 border-l border-dashed border-[#8daea0] pr-0 pb-8 pl-5 text-[#275951] lg:flex"
          aria-hidden="true"
        >
          {(trip.start_date === trip.end_date
            ? [trip.start_date]
            : [trip.start_date, trip.end_date]
          ).map((date, index) => (
            <span
              key={index}
              className={cn(
                "flex flex-col items-center text-[0.8125rem]",
                index > 0 &&
                  "before:absolute before:top-[47%] before:left-[51%] before:h-px before:w-3 before:bg-[#94b3a6] before:content-['']",
              )}
            >
              <b className="text-[2.75rem] font-semibold tracking-[-0.035em]">
                {Number(date.slice(-2))}
              </b>
              {new Intl.DateTimeFormat(undefined, {
                month: "short",
                timeZone: "UTC",
              }).format(new Date(`${date}T12:00:00Z`))}
            </span>
          ))}
          <small className="absolute inset-[auto_0_0.75rem_1rem] text-center text-[0.6875rem]">
            {days} {dayLabel} to make your own
          </small>
        </div>
      )}
    </Link>
  );
}
