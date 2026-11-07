"use client";

import type { Destination } from "@/components/features/trips/trip-form";
import { TripError } from "@/components/shared/trip-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PlaceCandidate } from "@/lib/places";

export function DestinationSearch({
  destination,
  query,
  setQuery,
  search,
  choose,
  results,
  searchPending,
  searchError,
}: {
  destination: Destination | null;
  query: string;
  setQuery: (query: string) => void;
  search: () => Promise<void>;
  choose: (candidate: PlaceCandidate) => Promise<void>;
  results: PlaceCandidate[] | null;
  searchPending: boolean;
  searchError: unknown;
}) {
  return (
    <div className="space-y-3">
      <Label htmlFor="trip-destination-search">Where are you going?</Label>
      <p id="trip-destination-help" className="text-sm text-muted-foreground">
        Search for a city or country, then choose your destination.
      </p>
      {destination && (
        <div className="rounded-xl border bg-secondary/40 p-4 text-sm">
          <p className="font-medium">{destination.name}</p>
          {destination.address && (
            <p className="break-words text-muted-foreground">
              {destination.address}
            </p>
          )}
          <p className="text-muted-foreground">
            Trip time zone: {destination.time_zone}
          </p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Input
          id="trip-destination-search"
          aria-describedby="trip-destination-help"
          className="min-h-11 min-w-0 flex-1"
          placeholder="e.g. Tokyo, Japan or Japan"
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
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={searchPending}
          onClick={() => void search()}
        >
          {searchPending ? "Loading…" : "Search"}
        </Button>
      </div>
      {results && (
        <div aria-live="polite">
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No destinations found.
            </p>
          ) : (
            <ul className="space-y-2">
              {results.map((candidate) => (
                <li key={candidate.provider_place_id}>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto min-h-11 w-full justify-start whitespace-normal text-left"
                    disabled={searchPending}
                    onClick={() => void choose(candidate)}
                  >
                    <span>
                      <strong>{candidate.name}</strong>
                      <br />
                      <span className="text-muted-foreground">
                        {candidate.address} · {candidate.time_zone}
                      </span>
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {!!searchError && <TripError error={searchError} />}
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
    </div>
  );
}
