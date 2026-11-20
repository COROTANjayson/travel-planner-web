"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { PlusIcon, SunIcon } from "@phosphor-icons/react";
import { ApiError, useApi } from "@/lib/api";
import { instantToLocal, localToInstant } from "@/lib/activity-time";
import { type Place, type PlaceCandidate } from "@/lib/places";
import {
  tripInput,
  formatTripDates,
  tripDayCount,
  validateTrip,
  type Trip,
  type TripInput,
} from "@/lib/trips";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { fieldRequired } from "@/components/shared/field-required";
import { Label } from "@/components/ui/label";
import { type LocalDraft } from "@/components/shared/date-time-field";
import { TripError } from "@/components/shared/trip-states";
import { DestinationSearch } from "@/components/features/trips/destination-search";
import { ExactTimesSection } from "@/components/features/trips/exact-times-section";
import { TripRangeFields } from "@/components/features/trips/trip-range-fields";

export type Destination = Pick<
  Place,
  "id" | "name" | "address" | "kind" | "time_zone"
>;
const empty: LocalDraft = { value: "", occurrence: "" };

export function TripForm({
  creating = false,
  initialValue,
  onSubmit,
  pending,
  error,
  submitLabel,
  cancel,
  beforeActions,
}: {
  creating?: boolean;
  initialValue?: Trip;
  onSubmit: (input: TripInput) => void;
  pending: boolean;
  error: unknown;
  submitLabel: string;
  cancel: ReactNode;
  beforeActions?: ReactNode;
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
  const [changing, setChanging] = useState(false);

  const start = times.start.value.slice(0, 10);
  const end = times.end.value.slice(0, 10);
  const days =
    creating && start && end && end >= start ? tripDayCount(start, end) : 0;
  const duration = `${days} ${days === 1 ? "day" : "days"}`;
  const destinationBasedName = destination ? `Trip to ${destination.name}` : "";
  const suggestion =
    new TextEncoder().encode(destinationBasedName).length <= 200
      ? destinationBasedName
      : "My trip";
  const createHint =
    !destination || !start || !end
      ? "Add a destination and dates"
      : !days
        ? "Fix the end date to continue"
        : exactTimes &&
            (!times.start.value.slice(11) || !times.end.value.slice(11))
          ? "Add arrival and departure times"
          : "";

  async function search() {
    if (pending || searchPending) return;
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
          creating &&
          (times.start.value.slice(11) || times.end.value.slice(11)) &&
          !window.confirm(
            "Changing the destination’s time zone clears the arrival and departure times. Continue?",
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
      setChanging(false);
      setQuery("");
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
    if (pending || searchPending || (creating && (changing || createHint)))
      return;
    try {
      if (!destination)
        throw new Error("Select a destination from the search results.");
      const input = tripInput({
        name: creating ? name.trim() || suggestion : name,
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
    <form
      onSubmit={submit}
      className={
        creating
          ? "max-w-[40rem] space-y-6"
          : "flex min-h-full flex-col space-y-6"
      }
    >
      <fieldset
        disabled={pending || searchPending}
        className={creating ? "min-w-0 space-y-7" : "min-w-0 space-y-4"}
      >
        <DestinationSearch
          destination={destination}
          changing={changing}
          setChanging={setChanging}
          query={query}
          setQuery={
            creating
              ? (value) => {
                  setQuery(value);
                  setResults(null);
                  setSearchError(null);
                }
              : setQuery
          }
          search={search}
          choose={choose}
          results={results}
          searchPending={searchPending}
          searchError={searchError}
        />
        {creating ? (
          <div className="space-y-3">
            <TripRangeFields
              dates={{ start, end }}
              onChange={(dates) => {
                setTimes((current) => ({
                  start:
                    dates.start === start
                      ? current.start
                      : {
                          value: `${dates.start}T${current.start.value.slice(11)}`,
                          occurrence: "",
                        },
                  end:
                    dates.end === end
                      ? current.end
                      : {
                          value: `${dates.end}T${current.end.value.slice(11)}`,
                          occurrence: "",
                        },
                }));
                setValidationError(undefined);
              }}
            />
            {exactTimes && renderExactTimes(true)}
            {!!days && destination && (
              <p className="flex w-fit items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm">
                <SunIcon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-primary"
                />
                {duration} in {destination.name}
              </p>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {(["start", "end"] as const).map((field) => (
              <div key={field} className="min-w-0 space-y-2">
                <Label htmlFor={`trip-${field}-date`} className={fieldRequired}>
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
        )}
        <div className={creating ? "space-y-2" : "space-y-2"}>
          <FormField
            id="trip-name"
            label={creating ? "Trip name" : "Give your trip a name"}
            className={creating ? "min-h-12" : "min-h-11"}
            required={!creating}
            placeholder={
              creating
                ? suggestion || "We’ll name it after your destination"
                : "e.g. A long weekend in Cebu"
            }
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          {creating && destination && !name.trim() && (
            <p className="text-sm text-muted-foreground">
              Leave blank to use “{suggestion}”.
            </p>
          )}
        </div>
        {creating ? (
          <Button
            type="button"
            variant="link"
            aria-expanded={exactTimes}
            className="min-h-11 px-0 whitespace-normal text-left"
            onClick={() => {
              setExactTimes(!exactTimes);
              setValidationError(undefined);
            }}
          >
            {!exactTimes && <PlusIcon aria-hidden="true" className="size-4" />}
            {exactTimes ? "Remove times" : "Add arrival and departure times"}
          </Button>
        ) : (
          renderExactTimes(false)
        )}
      </fieldset>
      {validationError && (
        <Alert variant="destructive">
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}
      {!!error && <TripError error={error} />}
      {beforeActions}
      {creating ? (
        <div className="fixed inset-x-0 bottom-0 z-30 grid gap-2 border-t bg-card px-5 pt-2.5 pb-[max(1rem,env(safe-area-inset-bottom))] md:static md:flex md:items-center md:justify-end md:gap-3 md:border-0 md:p-0">
          <p
            aria-live="polite"
            className="text-center text-xs text-muted-foreground md:mr-auto md:text-left md:text-sm"
          >
            {createHint || (
              <span className="block truncate md:hidden">
                {destination?.name} · {formatTripDates(start, end)} · {duration}
              </span>
            )}
          </p>
          <div className="hidden md:block">{cancel}</div>
          <Button
            type="submit"
            className="min-h-12 w-full md:w-auto"
            disabled={pending || searchPending || changing || !!createHint}
          >
            {pending ? "Saving…" : submitLabel}
          </Button>
        </div>
      ) : (
        <div className="sticky bottom-0 z-10 -mx-6 mt-auto grid grid-cols-2 gap-3 border-t bg-background px-6 py-4 md:flex md:justify-end">
          {cancel}
          <Button
            type="submit"
            className="min-h-11"
            disabled={pending || searchPending}
          >
            {pending ? "Saving…" : submitLabel}
          </Button>
        </div>
      )}
    </form>
  );

  function renderExactTimes(fieldsOnly: boolean) {
    return (
      <ExactTimesSection
        fieldsOnly={fieldsOnly}
        exactTimes={exactTimes}
        setExactTimes={setExactTimes}
        destination={destination}
        times={times}
        setTimes={setTimes}
        pending={pending}
        setValidationError={setValidationError}
      />
    );
  }
}
