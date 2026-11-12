"use client";

import { cn } from "@/lib/utils";
import { TripError } from "@/components/shared/trip-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Place, PlaceCandidate } from "@/lib/places";

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
  return (
    <section
      className={cn(section ? "space-y-2" : "border-t border-border py-2")}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[18px] leading-7 font-bold text-foreground">
          Place
        </h3>
      </div>
      <div className={cn("space-y-3", section ? "pt-4" : "pt-1 pb-4")}>
        <Label htmlFor={`${prefix}-place-search`} className="sr-only">
          Search for a place (optional)
        </Label>
        {place && (
          <div className="rounded-xl border bg-secondary/40 p-4 text-sm">
            <p className="font-medium leading-6 lg:max-w-[70ch]">
              {place.name}
            </p>
            <p className="break-words leading-6 text-muted-foreground lg:max-w-[70ch]">
              {place.address}
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-2 min-h-11"
              onClick={() => {
                setPlace(null);
              }}
            >
              Clear place
            </Button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Input
            id={`${prefix}-place-search`}
            autoFocus={!section || section === "place"}
            className="min-h-11 min-w-0 flex-1"
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
            variant="outline"
            className="min-h-11"
            onClick={() => void search()}
          >
            {placePending ? "Loading…" : "Search"}
          </Button>
        </div>
        {results && (
          <div aria-live="polite">
            {results.length === 0 ? (
              <p className="text-sm leading-6 text-muted-foreground lg:max-w-[70ch]">
                No places found.
              </p>
            ) : (
              <ul className="space-y-2 lg:max-w-[70ch]">
                {results.map((candidate) => (
                  <li
                    key={candidate.provider_place_id}
                    className="text-sm leading-6"
                  >
                    <Button
                      type="button"
                      variant="outline"
                      className="h-auto min-h-11 w-full justify-start whitespace-normal text-left"
                      onClick={() => void choose(candidate)}
                    >
                      <span>
                        <strong>{candidate.name}</strong>
                        <br />
                        <span className="text-muted-foreground">
                          {candidate.address}
                        </span>
                      </span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {!!placeError && <TripError error={placeError} />}
        <p className="text-sm leading-6 text-muted-foreground lg:max-w-[70ch]">
          Searches run only when you press Search. Place data ©{" "}
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
      </div>
    </section>
  );
}
