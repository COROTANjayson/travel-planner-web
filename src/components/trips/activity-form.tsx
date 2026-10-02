"use client";

import { useId, useState, type FormEvent } from "react";
import { ApiError, useApi } from "@/lib/api";
import { type ActivityInput } from "@/lib/itinerary";
import { type Place, type PlaceCandidate } from "@/lib/places";
import { dateTimeInputValue, instantToLocal, inspectLocalTime, localToInstant, type Occurrence } from "@/lib/activity-time";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TripError } from "./trip-states";

export function ActivityForm({ initialValue, initialPlace, tripZone, onSubmit, onCancel, pending, error }: {
  initialValue?: ActivityInput; initialPlace?: Place | null; tripZone: string; onSubmit: (input: ActivityInput) => void;
  onCancel: () => void; pending: boolean; error: unknown;
}) {
  const prefix = useId();
  const api = useApi();
  const [title, setTitle] = useState(initialValue?.title ?? "");
  const [notes, setNotes] = useState(initialValue?.notes ?? "");
  const [zone, setZone] = useState(initialValue?.time_zone ?? tripZone);
  const [zoneDraft, setZoneDraft] = useState(zone);
  const [times, setTimes] = useState(() => ({
    start: initialValue ? instantToLocal(initialValue.starts_at, initialValue.time_zone) : { value: "", occurrence: "" as Occurrence },
    end: initialValue ? instantToLocal(initialValue.ends_at, initialValue.time_zone) : { value: "", occurrence: "" as Occurrence },
  }));
  const [validationError, setValidationError] = useState<string>();
  const [place, setPlace] = useState<Place | null>(initialPlace ?? null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceCandidate[] | null>(null);
  const [placeError, setPlaceError] = useState<unknown>(null);
  const [placePending, setPlacePending] = useState(false);
  const [zones] = useState(() => typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : null);
  const options = zones && Array.from(new Set([zone, tripZone, "UTC", ...zones])).sort();

  function changeZone(nextZone: string) {
    try {
      // Convert the current draft, including an explicitly chosen repeated hour.
      const start = times.start.value ? instantToLocal(localToInstant(times.start.value, zone, times.start.occurrence), nextZone) : times.start;
      const end = times.end.value ? instantToLocal(localToInstant(times.end.value, zone, times.end.occurrence), nextZone) : times.end;
      // Validate the zone even when both time inputs are empty.
      new Intl.DateTimeFormat(undefined, { timeZone: nextZone });
      setTimes({ start, end }); setZone(nextZone); setZoneDraft(nextZone); setValidationError(undefined);
    } catch (cause) {
      setValidationError(cause instanceof Error ? cause.message : "Choose a valid time zone.");
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || placePending) return;
    try {
      if (zoneDraft !== zone) throw new Error("Apply the selected time zone before saving.");
      const input: ActivityInput = {
        title, notes, time_zone: zone, place_id: place?.id ?? null,
        starts_at: localToInstant(times.start.value, zone, times.start.occurrence),
        ends_at: localToInstant(times.end.value, zone, times.end.occurrence),
      };
      setValidationError(undefined);
      onSubmit(input);
    } catch (cause) {
      setValidationError(cause instanceof Error ? cause.message : "Check the activity times.");
    }
  }

  async function search() {
    const term = query.trim();
    if (placePending || new TextEncoder().encode(term).length < 2 || new TextEncoder().encode(term).length > 200) {
      setPlaceError(new Error("Enter 2–200 bytes to search places."));
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
      setPlace(selected); setResults(null);
    } catch (cause) { setPlaceError(cause); }
    finally { setPlacePending(false); }
  }

  return <form onSubmit={submit} className="space-y-5">
    <fieldset disabled={pending || placePending} className="min-w-0 space-y-5">
      <div className="space-y-2"><Label htmlFor={`${prefix}-title`}>Activity title</Label>
        <Input id={`${prefix}-title`} className="min-h-11" required value={title} onChange={(event) => setTitle(event.target.value)} />
      </div>
      <div className="space-y-3">
        <Label htmlFor={`${prefix}-place-search`}>Place (optional)</Label>
        {place && <div className="rounded-lg border p-3 text-sm">
          <p className="font-medium">{place.name}</p>
          <p className="break-words text-muted-foreground">{place.address}</p>
          <p className="text-muted-foreground">Place time zone: {place.time_zone}</p>
          <Button type="button" variant="outline" className="mt-2 min-h-11" disabled={pending || placePending} onClick={() => setPlace(null)}>Clear place</Button>
        </div>}
        <div className="flex flex-wrap gap-2">
          <Input id={`${prefix}-place-search`} className="min-h-11 min-w-0 flex-1" value={query} onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); void search(); } }} placeholder="Search for a place" />
          <Button type="button" variant="outline" className="min-h-11" disabled={pending || placePending} onClick={() => void search()}>{placePending ? "Loading…" : "Search"}</Button>
        </div>
        {results && <div aria-live="polite">
          {results.length === 0 ? <p className="text-sm text-muted-foreground">No places found.</p> :
            <ul className="space-y-2">{results.map((candidate) => <li key={candidate.provider_place_id}>
              <Button type="button" variant="outline" className="h-auto min-h-11 w-full justify-start whitespace-normal text-left" disabled={placePending}
                onClick={() => void choose(candidate)}><span><strong>{candidate.name}</strong><br /><span className="text-muted-foreground">{candidate.address}</span></span></Button>
            </li>)}</ul>}
        </div>}
        {!!placeError && <TripError error={placeError} />}
        <p className="text-xs text-muted-foreground">Searches run only when you press Search. Place data © <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>.</p>
      </div>
      <div className="space-y-2"><Label htmlFor={`${prefix}-zone`}>Activity time zone</Label>
        {options ? <Select value={zone} disabled={pending} onValueChange={(value) => { if (value) changeZone(value); }}>
          <SelectTrigger id={`${prefix}-zone`} className="min-h-11 w-full"><SelectValue /></SelectTrigger>
          <SelectContent>{options.map((option) => <SelectItem className="min-h-11" key={option} value={option}>{option}</SelectItem>)}</SelectContent>
        </Select> : <div className="flex flex-wrap gap-2">
          <Input id={`${prefix}-zone`} className="min-h-11" required value={zoneDraft} onChange={(event) => setZoneDraft(event.target.value)} />
          <Button type="button" variant="outline" className="min-h-11" onClick={() => changeZone(zoneDraft.trim())}>Apply time zone</Button>
        </div>}
        <p className="text-sm text-muted-foreground">Times are local to this zone. Changing the zone preserves the scheduled instants.</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {(["start", "end"] as const).map((field) => {
          const time = times[field];
          const inspected = inspectLocalTime(time.value, zone);
          const label = field === "start" ? "Start" : "End";
          return <div key={field} className="min-w-0 space-y-2">
            <Label htmlFor={`${prefix}-${field}`}>{label} date and time</Label>
            <Input id={`${prefix}-${field}`} className="min-h-11 w-full min-w-0" type="datetime-local" step="any" required
              value={dateTimeInputValue(time.value)} aria-invalid={!!inspected.error} aria-describedby={inspected.error ? `${prefix}-${field}-error` : undefined}
              onChange={(event) => {
                setTimes((current) => ({ ...current, [field]: { value: event.target.value, occurrence: "" } }));
                setValidationError(undefined);
              }} />
            {inspected.error && <p id={`${prefix}-${field}-error`} role="alert" className="text-sm text-destructive">{inspected.error}</p>}
            {inspected.choices.length === 2 && <div className="space-y-2">
              <Label htmlFor={`${prefix}-${field}-occurrence`}>{label} time occurrence</Label>
              <Select value={time.occurrence || null} disabled={pending} onValueChange={(value) => {
                if (value === "earlier" || value === "later") {
                  setTimes((current) => ({ ...current, [field]: { ...current[field], occurrence: value } }));
                  setValidationError(undefined);
                }
              }}>
                <SelectTrigger id={`${prefix}-${field}-occurrence`} className="min-h-11 w-full"><SelectValue placeholder="Choose an occurrence" /></SelectTrigger>
                <SelectContent>{inspected.choices.map((choice) => <SelectItem className="min-h-11" key={choice.occurrence} value={choice.occurrence}>
                  {choice.occurrence === "earlier" ? "Earlier" : "Later"} (UTC{choice.offset})
                </SelectItem>)}</SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">The clocks move back, so this time occurs twice.</p>
            </div>}
          </div>;
        })}
      </div>
      <div className="space-y-2"><Label htmlFor={`${prefix}-notes`}>Activity notes (optional)</Label>
        <textarea id={`${prefix}-notes`} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)}
          className="w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50" />
      </div>
    </fieldset>
    {validationError && <Alert variant="destructive"><AlertDescription>{validationError}</AlertDescription></Alert>}
    {!!error && <TripError error={error} />}
    <div className="flex flex-wrap gap-3">
      <Button type="submit" className="min-h-11" disabled={pending || placePending}>{pending ? "Saving…" : initialValue ? "Save activity" : "Create activity"}</Button>
      <Button type="button" variant="outline" className="min-h-11" disabled={pending} onClick={onCancel}>Cancel</Button>
    </div>
  </form>;
}
