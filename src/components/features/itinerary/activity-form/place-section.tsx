"use client";

import { useState } from "react";
import { MagnifyingGlassIcon, MapPinIcon, XIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { TripError } from "@/components/shared/trip-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Place, PlaceCandidate } from "@/lib/places";

// Chosen place and results follow the Figma "Destination row", "Dropdown
// list" and "Search result" components.
export function PlaceSection({
  prefix,
  section,
  place,
  setPlace,
  query,
  setQuery,
  search,
  choose,
  results,
  placePending,
  placeError,
}: {
  prefix: string;
  section?: "details" | "place" | "notes" | "checklist";
  place: Place | null;
  setPlace: (place: Place | null) => void;
  query: string;
  setQuery: (query: string) => void;
  search: () => Promise<void>;
  choose: (candidate: PlaceCandidate) => Promise<void>;
  results: PlaceCandidate[] | null;
  placePending: boolean;
  placeError: unknown;
}) {
  const [changing, setChanging] = useState(false);
  const searching = !place || changing;
  return (
    <section
      className={cn(section ? "space-y-2" : "border-t border-border py-2")}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[18px] leading-7 font-bold text-foreground">
          Place
        </h3>
      </div>
      <div className={cn("space-y-2", section ? "pt-4" : "pt-1 pb-4")}>
        {!searching ? (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary py-2 pr-2 pl-4">
            <MapPinIcon
              aria-hidden="true"
              className="size-[18px] shrink-0 text-primary"
            />
            <div className="min-w-0 flex-1 py-1">
              <p className="text-base leading-6 font-medium wrap-break-word">
                {place.name}
              </p>
              <p className="text-[13px] leading-5 wrap-break-word text-muted-foreground">
                {place.address}
              </p>
            </div>
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => setChanging(true)}
            >
              Change
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove place"
              className="size-11 min-h-11 text-muted-foreground"
              onClick={() => setPlace(null)}
            >
              <XIcon aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <>
            <Label htmlFor={`${prefix}-place-search`} className="sr-only">
              Search for a place (optional)
            </Label>
            <div className="relative">
              <MagnifyingGlassIcon
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id={`${prefix}-place-search`}
                autoFocus={!section || section === "place" || changing}
                className="pr-24 pl-9 md:min-h-12"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    void search();
                  }
                }}
                placeholder="Search for a place"
                enterKeyHint="search"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="absolute top-1/2 right-2 -translate-y-1/2"
                onClick={() => void search()}
              >
                {placePending ? "Loading…" : "Search"}
              </Button>
            </div>
            {results && (
              <div aria-live="polite">
                {results.length === 0 ? (
                  <p className="text-[13px] leading-5 text-muted-foreground">
                    No places found. Try a different name.
                  </p>
                ) : (
                  <ul
                    aria-label="Place results"
                    className="rounded-lg border border-border bg-popover p-1 shadow-[0_8px_24px_rgb(18_60_64/0.12)]"
                  >
                    {results.map((candidate) => (
                      <li key={candidate.provider_place_id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left outline-none hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => {
                            setChanging(false);
                            void choose(candidate);
                          }}
                        >
                          <MapPinIcon
                            aria-hidden="true"
                            className="size-4 shrink-0 text-muted-foreground"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-base leading-6 font-medium wrap-break-word">
                              {candidate.name}
                            </span>
                            <span className="block text-[13px] leading-5 wrap-break-word text-muted-foreground">
                              {candidate.address}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {place && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="px-0"
                onClick={() => {
                  setChanging(false);
                  setQuery("");
                }}
              >
                Keep {place.name}
              </Button>
            )}
          </>
        )}
        {!!placeError && <TripError error={placeError} />}
        {searching && (
          <p className="text-[13px] leading-5 text-muted-foreground">
            Press Enter or Search to look up a place. Place data ©{" "}
            <a
              className="underline"
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
            >
              OpenStreetMap contributors
            </a>
            .
          </p>
        )}
      </div>
    </section>
  );
}
