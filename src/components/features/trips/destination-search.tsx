"use client";

import type { Destination } from "@/components/features/trips/trip-form";
import { TripError } from "@/components/shared/trip-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PlaceCandidate } from "@/lib/places";
import { MapPinIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { fieldRequired } from "@/components/shared/field-required";

export function DestinationSearch({
  destination,
  changing,
  setChanging,
  query,
  setQuery,
  search,
  choose,
  results,
  searchPending,
  searchError,
}: {
  destination: Destination | null;
  changing: boolean;
  setChanging: (changing: boolean) => void;
  query: string;
  setQuery: (query: string) => void;
  search: () => Promise<void>;
  choose: (candidate: PlaceCandidate) => Promise<void>;
  results: PlaceCandidate[] | null;
  searchPending: boolean;
  searchError: unknown;
}) {
  return (
    <div className="space-y-2">
      {destination && !changing ? (
        <>
          <p className={fieldRequired}>Where are you going?</p>
          <div className="flex items-center gap-4 rounded-lg border bg-secondary p-4">
            <MapPinIcon
              aria-hidden="true"
              className="size-5 shrink-0 text-primary"
            />
            <div className="min-w-0 flex-1 space-y-1 break-words text-sm">
              <p className="text-lg font-medium">{destination.name}</p>
              <p className="text-muted-foreground">
                {[
                  destination.address,
                  `${destination.time_zone.split("/").pop()?.replaceAll("_", " ")} time`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 rounded-full px-1 text-sm font-normal text-primary"
              onClick={() => setChanging(true)}
            >
              Change
            </Button>
          </div>
        </>
      ) : (
        <>
          <Label htmlFor="trip-destination-search" className={fieldRequired}>
            Where are you going?
          </Label>
          <div className="isolate flex -space-x-px">
            <div className="relative min-w-0 flex-1 focus-within:z-10">
              <MagnifyingGlassIcon
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="trip-destination-search"
                autoFocus={changing}
                className="min-h-12 rounded-r-none pl-9"
                placeholder="Search for a city or country"
                enterKeyHint="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    void search();
                  }
                }}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="relative min-h-12 rounded-l-none rounded-r-lg focus-visible:z-10"
              disabled={searchPending}
              onClick={() => void search()}
            >
              Search
            </Button>
          </div>
          {destination && (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              onClick={() => {
                setQuery("");
                setChanging(false);
              }}
            >
              Keep current destination
            </Button>
          )}
          <div aria-live="polite">
            {searchPending && (
              <p className="text-sm text-muted-foreground">
                Loading destinations…
              </p>
            )}
            {!searchPending && results?.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No destinations found.
              </p>
            )}
            {!!results?.length && !searchPending && (
              <ul
                aria-label="Destination results"
                className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm"
              >
                {results.map((candidate) => (
                  <li key={candidate.provider_place_id}>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto min-h-11 w-full justify-start rounded-none px-3 py-2.5 text-left whitespace-normal hover:bg-secondary"
                      onClick={() => void choose(candidate)}
                    >
                      <MapPinIcon
                        aria-hidden="true"
                        className="size-4 shrink-0 text-primary"
                      />
                      <span className="min-w-0 flex-1 break-words">
                        <strong className="block font-medium">
                          {candidate.name}
                        </strong>
                        <span className="block text-xs font-normal text-muted-foreground">
                          {candidate.address} · {candidate.time_zone}
                        </span>
                      </span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
      {!!searchError && <TripError error={searchError} />}
      {(!destination || changing) && <Attribution />}
    </div>
  );
}

function Attribution() {
  return (
    <p className="text-xs text-muted-foreground">
      Place data ©{" "}
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
  );
}
