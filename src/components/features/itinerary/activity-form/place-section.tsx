"use client";

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
  markDirty,
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
  markDirty: () => void;
  query: string;
  setQuery: (query: string) => void;
  search: () => Promise<void>;
  choose: (candidate: PlaceCandidate) => Promise<void>;
  results: PlaceCandidate[] | null;
  placePending: boolean;
  placeError: unknown;
}) {
  return (
    <section className={section ? "space-y-2" : undefined}>
      <div className="activity-section-heading">
        <h3>Place</h3>
      </div>
      <div className="space-y-3 pt-4">
        <Label htmlFor={`${prefix}-place-search`} className="sr-only">
          Search for a place (optional)
        </Label>
        {place && (
          <div className="rounded-xl border bg-secondary/40 p-4 text-sm">
            <p className="font-medium">{place.name}</p>
            <p className="break-words text-muted-foreground">{place.address}</p>
            <Button
              type="button"
              variant="outline"
              className="mt-2 min-h-11"
              onClick={() => {
                setPlace(null);
                markDirty();
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
              <p className="text-sm text-muted-foreground">No places found.</p>
            ) : (
              <ul className="space-y-2">
                {results.map((candidate) => (
                  <li key={candidate.provider_place_id}>
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
        <p className="text-xs text-muted-foreground">
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
