"use client";

import { useId, useState, type Ref, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Temporal } from "@js-temporal/polyfill";
import { ApiError, useApi } from "@/lib/api";
import { type ActivityInput } from "@/lib/itinerary";
import { type Place, type PlaceCandidate } from "@/lib/places";
import { endAfterMinutes, instantToLocal, localToInstant, type Occurrence } from "@/lib/activity-time";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TripError } from "./trip-states";
import { DateTimeField } from "./date-time-field";

const durations = { "30": 30, "60": 60, "120": 120 } as const;
type Duration = keyof typeof durations | "custom";

function formatEndTime(instant: string, zone: string, startDate: string) {
  const local = instantToLocal(instant, zone).value;
  const time = new Intl.DateTimeFormat(undefined, { timeZone: zone, timeStyle: "short" }).format(new Date(instant));
  return `${time}${local.slice(0, 10) > startDate ? " next day" : ""}`;
}

export function ActivityForm({ titleRef, initialValue, initialDate, initialStartsAt, initialPlace, tripZone, tripID, tripStart, tripEnd, tripStartsAt, tripEndsAt, onSubmit, onCancel, onDirty, pending, error }: {
  initialValue?: ActivityInput & { id?: number }; initialPlace?: Place | null; tripZone: string; tripID: number;
  initialDate?: string; initialStartsAt?: string; titleRef?: Ref<HTMLInputElement>;
  tripStart: string; tripEnd: string; tripStartsAt: string | null; tripEndsAt: string | null; onSubmit: (input: ActivityInput) => void;
  onCancel: () => void; onDirty?: () => void; pending: boolean; error: unknown;
}) {
  const prefix = useId();
  const api = useApi();
  const [title, setTitle] = useState(initialValue?.title ?? "");
  const [notes, setNotes] = useState(initialValue?.notes ?? "");
  const [times, setTimes] = useState(() => ({
    start: initialValue ? instantToLocal(initialValue.starts_at, tripZone) : initialStartsAt ? instantToLocal(initialStartsAt, tripZone) : { value: initialDate ? `${initialDate}T` : "", occurrence: "" as Occurrence },
    end: initialValue ? instantToLocal(initialValue.ends_at, tripZone) : { value: initialDate ? `${initialDate}T` : "", occurrence: "" as Occurrence },
  }));
  const [duration, setDuration] = useState<Duration>(() => {
    if (!initialValue) return "60";
    const minutes = Number((Temporal.Instant.from(initialValue.ends_at).epochNanoseconds - Temporal.Instant.from(initialValue.starts_at).epochNanoseconds) / BigInt(60_000_000_000));
    return String(minutes) in durations && Temporal.Instant.from(initialValue.starts_at).add({ minutes }).equals(Temporal.Instant.from(initialValue.ends_at)) ? String(minutes) as Duration : "custom";
  });
  const [timeChanged, setTimeChanged] = useState(false);
  const [validationError, setValidationError] = useState<string>();
  const [place, setPlace] = useState<Place | null>(initialPlace ?? null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceCandidate[] | null>(null);
  const [placeError, setPlaceError] = useState<unknown>(null);
  const [placePending, setPlacePending] = useState(false);
  let interval: { start: string; end: string } | null = null;
  try {
    const start = initialValue && !timeChanged ? initialValue.starts_at : localToInstant(times.start.value, tripZone, times.start.occurrence);
    const end = initialValue && !timeChanged ? initialValue.ends_at : duration === "custom"
      ? localToInstant(times.end.value, tripZone, times.end.occurrence)
      : endAfterMinutes(start, durations[duration]);
    if (Temporal.Instant.compare(end, start) > 0) interval = { start, end };
  } catch { /* Wait for complete local dates and times. */ }
  const overlaps = useQuery({
    queryKey: ["trip", tripID, "overlaps", interval?.start, interval?.end, initialValue?.id ?? 0],
    enabled: interval !== null,
    queryFn: () => api<Array<{ id: number; title: string; starts_at: string; ends_at: string }>>(
      `/api/v1/trips/${tripID}/activities/overlaps?starts_at=${encodeURIComponent(interval!.start)}&ends_at=${encodeURIComponent(interval!.end)}&exclude_id=${initialValue?.id ?? 0}`),
    retry: false,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || placePending) return;
    try {
      const input: ActivityInput = {
        title, notes, time_zone: tripZone, place_id: place?.id ?? null,
        starts_at: interval?.start ?? localToInstant(times.start.value, tripZone, times.start.occurrence),
        ends_at: interval?.end ?? (duration === "custom" ? localToInstant(times.end.value, tripZone, times.end.occurrence) : ""),
      };
      if (Temporal.Instant.compare(input.ends_at, input.starts_at) <= 0) throw new Error("Activity end must be after start.");
      if (tripStartsAt && (Temporal.Instant.compare(input.starts_at, tripStartsAt) < 0 || Temporal.Instant.compare(input.ends_at, tripEndsAt!) > 0)) throw new Error("Activity must fit within the trip's start and end times.");
      if (!tripStartsAt && (times.start.value.slice(0, 10) < tripStart || instantToLocal(input.ends_at, tripZone).value.slice(0, 10) > tripEnd)) throw new Error("Activity dates must fit within the trip dates.");
      setValidationError(undefined);
      onSubmit(input);
    } catch (cause) {
      setValidationError(cause instanceof Error ? cause.message : "Check the activity times.");
    }
  }

  async function search() {
    const term = query.trim();
    const size = new TextEncoder().encode(term).length;
    if (placePending || size < 2 || size > 200) {
      setPlaceError(new Error(size < 2 ? "Enter at least 2 characters to search." : "Use a shorter place name."));
      return;
    }
    setPlacePending(true); setPlaceError(null); setResults(null);
    try {
      const found = await api<PlaceCandidate[]>(`/api/v1/places/search?q=${encodeURIComponent(term)}`);
      setResults(found ?? []);
    } catch (cause) { setPlaceError(cause); }
    finally { setPlacePending(false); }
  }

  async function choose(candidate: PlaceCandidate) {
    if (placePending) return;
    setPlacePending(true); setPlaceError(null);
    try {
      const selected = await api<Place>("/api/v1/places/resolve", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_place_id: candidate.provider_place_id }),
      });
      if (!selected) throw new ApiError(500, "Unable to save the place. Please try again.");
      setPlace(selected); setResults(null); onDirty?.();
    } catch (cause) { setPlaceError(cause); }
    finally { setPlacePending(false); }
  }

  return <form onSubmit={submit} onChangeCapture={onDirty} className="space-y-5">
    <fieldset disabled={pending || placePending} className="min-w-0 space-y-5">
      <div className="space-y-2"><Label htmlFor={`${prefix}-title`}>What are you doing?</Label>
        <Input ref={titleRef} placeholder="e.g. Dinner at the waterfront" id={`${prefix}-title`} className="min-h-11" required value={title} onChange={(event) => setTitle(event.target.value)} />
      </div>
      <div className="space-y-5">
        <DateTimeField id={`${prefix}-start`} label="Start" zone={tripZone} draft={times.start} split hideDate={!!initialDate && !initialValue}
          minDate={tripStart} maxDate={tripEnd} disabled={pending}
          onChange={(next) => { setTimes((current) => ({ ...current, start: next })); setTimeChanged(true); setValidationError(undefined); onDirty?.(); }} />
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-duration`}>Duration</Label>
          <Select value={duration} onValueChange={(value) => { if (value === "30" || value === "60" || value === "120" || value === "custom") { setDuration(value); setTimeChanged(true); setValidationError(undefined); onDirty?.(); } }}>
            <SelectTrigger id={`${prefix}-duration`} className="min-h-11 w-full"><SelectValue>{duration === "30" ? "30 minutes" : duration === "60" ? "1 hour" : duration === "120" ? "2 hours" : "Custom end time"}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 minutes</SelectItem><SelectItem value="60">1 hour</SelectItem>
              <SelectItem value="120">2 hours</SelectItem><SelectItem value="custom">Custom end time</SelectItem>
            </SelectContent>
          </Select>
          {duration !== "custom" && interval && <p className="text-sm text-muted-foreground">Ends {formatEndTime(interval.end, tripZone, times.start.value.slice(0, 10))}</p>}
        </div>
      </div>
      {duration === "custom" && <DateTimeField id={`${prefix}-end`} label="End" zone={tripZone} draft={times.end} split
        minDate={times.start.value.slice(0, 10) > tripStart ? times.start.value.slice(0, 10) : tripStart} maxDate={tripEnd} disabled={pending}
        onChange={(next) => { setTimes((current) => ({ ...current, end: next })); setTimeChanged(true); setValidationError(undefined); onDirty?.(); }} />}
      {interval && (overlaps.isPending ? <p role="status" className="text-sm">Checking other activities…</p> : overlaps.isError ?
        <TripError error={overlaps.error} retry={() => void overlaps.refetch()} /> : overlaps.data && overlaps.data.length > 0 ?
          <Alert><AlertDescription>Overlaps {overlaps.data.map((item) => item.title).join(", ")}. Parallel activities are allowed.</AlertDescription></Alert> : null)}
      <div className="space-y-3">
            <Label htmlFor={`${prefix}-place-search`}>Place (optional)</Label>
            {place && <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{place.name}</p><p className="break-words text-muted-foreground">{place.address}</p>
              <Button type="button" variant="outline" className="mt-2 min-h-11" onClick={() => { setPlace(null); onDirty?.(); }}>Clear place</Button>
            </div>}
            <div className="flex flex-wrap gap-2">
              <Input id={`${prefix}-place-search`} className="min-h-11 min-w-0 flex-1" value={query} onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); void search(); } }} placeholder="Search for a place" />
              <Button type="button" variant="outline" className="min-h-11" onClick={() => void search()}>{placePending ? "Loading…" : "Search"}</Button>
            </div>
            {results && <div aria-live="polite">{results.length === 0 ? <p className="text-sm text-muted-foreground">No places found.</p> :
              <ul className="space-y-2">{results.map((candidate) => <li key={candidate.provider_place_id}>
                <Button type="button" variant="outline" className="h-auto min-h-11 w-full justify-start whitespace-normal text-left"
                  onClick={() => void choose(candidate)}><span><strong>{candidate.name}</strong><br /><span className="text-muted-foreground">{candidate.address}</span></span></Button>
              </li>)}</ul>}
            </div>}
            {!!placeError && <TripError error={placeError} />}
            <p className="text-xs text-muted-foreground">Searches run only when you press Search. Place data © <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>.</p>
      </div>
      <details className="rounded-lg border p-3" open={!!initialValue?.notes}>
        <summary className="cursor-pointer font-medium">Notes (optional)</summary>
        <div className="mt-4 space-y-4">
          <div className="space-y-2"><Label htmlFor={`${prefix}-notes`}>Activity notes</Label>
            <textarea id={`${prefix}-notes`} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)}
              className="w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50" />
          </div>
        </div>
      </details>
    </fieldset>
    {validationError && <Alert variant="destructive"><AlertDescription>{validationError}</AlertDescription></Alert>}
    {!!error && <TripError error={error} />}
    <div className="form-actions">
      <Button type="submit" className="min-h-11" disabled={pending || placePending}>{pending ? "Saving…" : initialValue ? "Save changes" : "Add activity"}</Button>
      <Button type="button" variant="outline" className="min-h-11" disabled={pending} onClick={onCancel}>Cancel</Button>
    </div>
  </form>;
}
