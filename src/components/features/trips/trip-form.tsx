"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { ApiError, useApi } from "@/lib/api";
import { instantToLocal, localToInstant } from "@/lib/activity-time";
import { type Place, type PlaceCandidate } from "@/lib/places";
import {
  tripInput,
  validateTrip,
  type Trip,
  type TripInput,
} from "@/lib/trips";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type LocalDraft } from "@/components/shared/date-time-field";
import { TripError } from "@/components/shared/trip-states";
import { DestinationSearch } from "@/components/features/trips/destination-search";
import { ExactTimesSection } from "@/components/features/trips/exact-times-section";

export type Destination = Pick<
  Place,
  "id" | "name" | "address" | "kind" | "time_zone"
>;
const empty: LocalDraft = { value: "", occurrence: "" };

export function TripForm({
  initialValue,
  onSubmit,
  pending,
  error,
  submitLabel,
  cancel,
}: {
  initialValue?: Trip;
  onSubmit: (input: TripInput) => void;
  pending: boolean;
  error: unknown;
  submitLabel: string;
  cancel: ReactNode;
}) {
  const api = useApi();
  const [name, setName] = useState(initialValue?.name ?? "");
  const [destination, setDestination] = useState<Destination | null>(() =>
    initialValue?.destination_place_id
      ? {
          id: initialValue.destination_place_id,
          name: initialValue.destination,
          address: "",
          kind: "city",
          time_zone: initialValue.time_zone,
        }
      : null,
  );
  const [times, setTimes] = useState<{ start: LocalDraft; end: LocalDraft }>(
    () => ({
      start: initialValue?.starts_at
        ? instantToLocal(initialValue.starts_at, initialValue.time_zone)
        : initialValue
          ? { value: `${initialValue.start_date}T`, occurrence: "" }
          : empty,
      end: initialValue?.ends_at
        ? instantToLocal(initialValue.ends_at, initialValue.time_zone)
        : initialValue
          ? { value: `${initialValue.end_date}T`, occurrence: "" }
          : empty,
    }),
  );
  const [exactTimes, setExactTimes] = useState(!!initialValue?.starts_at);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceCandidate[] | null>(null);
  const [searchError, setSearchError] = useState<unknown>(null);
  const [searchPending, setSearchPending] = useState(false);
  const [validationError, setValidationError] = useState<string>();

  async function search() {
    const term = query.trim();
    const size = new TextEncoder().encode(term).length;
    if (size < 2 || size > 200) {
      setSearchError(
        new ApiError(
          400,
          size < 2
            ? "Enter at least 2 characters to search."
            : "Use a shorter destination name.",
        ),
      );
      return;
    }
    setSearchPending(true);
    setSearchError(null);
    setResults(null);
    try {
      const found =
        (await api<PlaceCandidate[]>(
          `/api/v1/places/search?scope=destination&q=${encodeURIComponent(term)}`,
        )) ?? [];
      if (found.some((item) => !item.kind))
        throw new ApiError(
          500,
          "Destination search is unavailable. Please try again later.",
        );
      setResults(found);
    } catch (cause) {
      setSearchError(cause);
    } finally {
      setSearchPending(false);
    }
  }

  async function choose(candidate: PlaceCandidate) {
    setSearchPending(true);
    setSearchError(null);
    try {
      const selected = await api<Place>("/api/v1/places/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_place_id: candidate.provider_place_id,
        }),
      });
      if (!selected || !selected.kind)
        throw new ApiError(
          500,
          "Destination search is unavailable. Please try again later.",
        );
      if (selected.kind !== "city" && selected.kind !== "country")
        throw new ApiError(
          400,
          "Select another destination from the search results.",
        );
      if (
        destination &&
        destination.time_zone !== selected.time_zone &&
        exactTimes
      ) {
        if (
          (times.start.value.slice(11) || times.end.value.slice(11)) &&
          !window.confirm(
            "This destination uses a different time zone. Your dates will stay selected, but you will need to enter exact times again. Continue?",
          )
        )
          return;
        setTimes((current) => ({
          start: {
            value: `${current.start.value.slice(0, 10)}T`,
            occurrence: "",
          },
          end: { value: `${current.end.value.slice(0, 10)}T`, occurrence: "" },
        }));
      }
      setDestination(selected);
      setResults(null);
      setValidationError(undefined);
    } catch (cause) {
      setSearchError(cause);
    } finally {
      setSearchPending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || searchPending) return;
    try {
      if (!destination)
        throw new Error("Select a destination from the search results.");
      const input = tripInput({
        name,
        destination_place_id: destination.id,
        start_date: times.start.value.slice(0, 10),
        end_date: times.end.value.slice(0, 10),
        starts_at: exactTimes
          ? localToInstant(
              times.start.value,
              destination.time_zone,
              times.start.occurrence,
            )
          : null,
        ends_at: exactTimes
          ? localToInstant(
              times.end.value,
              destination.time_zone,
              times.end.occurrence,
            )
          : null,
      });
      const message = validateTrip(input);
      if (message) throw new Error(message);
      setValidationError(undefined);
      onSubmit(input);
    } catch (cause) {
      setValidationError(
        cause instanceof Error
          ? cause.message
          : "Check the trip dates and times.",
      );
    }
  }

  return (
    <form onSubmit={submit} className="max-w-[40rem] space-y-6">
      <fieldset
        disabled={pending || searchPending}
        className="min-w-0 space-y-5"
      >
        <DestinationSearch
          destination={destination}
          query={query}
          setQuery={setQuery}
          search={search}
          choose={choose}
          results={results}
          searchPending={searchPending}
          searchError={searchError}
        />
        <div className="form-section grid gap-5 sm:grid-cols-2">
          {(["start", "end"] as const).map((field) => (
            <div key={field} className="min-w-0 space-y-2">
              <Label htmlFor={`trip-${field}-date`}>
                {field === "start" ? "Start date" : "End date"}
              </Label>
              <Input
                id={`trip-${field}-date`}
                type="date"
                required
                className="min-h-11"
                value={times[field].value.slice(0, 10)}
                min={
                  field === "end"
                    ? times.start.value.slice(0, 10) || undefined
                    : undefined
                }
                max="9999-12-31"
                onChange={(event) => {
                  const date = event.target.value;
                  setTimes((current) => ({
                    ...current,
                    [field]: {
                      value: `${date}T${current[field].value.slice(11)}`,
                      occurrence: "",
                    },
                  }));
                  setValidationError(undefined);
                }}
              />
            </div>
          ))}
        </div>
        <div className="form-section space-y-2">
          <Label htmlFor="trip-name">Give your trip a name</Label>
          <Input
            id="trip-name"
            className="min-h-11"
            required
            placeholder="e.g. A long weekend in Cebu"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <ExactTimesSection
          exactTimes={exactTimes}
          setExactTimes={setExactTimes}
          destination={destination}
          times={times}
          setTimes={setTimes}
          pending={pending}
          setValidationError={setValidationError}
        />
      </fieldset>
      {validationError && (
        <Alert variant="destructive">
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}
      {!!error && <TripError error={error} />}
      <div className="form-actions">
        <Button
          type="submit"
          className="min-h-11"
          disabled={pending || searchPending}
        >
          {pending ? "Saving…" : submitLabel}
        </Button>
        {cancel}
      </div>
    </form>
  );
}
