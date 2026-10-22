"use client";

import { useId, useRef, useState, type Ref, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Temporal } from "@js-temporal/polyfill";
import { ApiError, useApi } from "@/lib/api";
import { activityCategories, type ActivityInput, type ChecklistItem } from "@/lib/itinerary";
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
  return `${time}${local.slice(0, 10) > startDate ? ` on ${local.slice(0, 10)}` : ""}`;
}

export function ActivityForm({ titleRef, initialValue, initialDate, initialStartsAt, initialCategory = "Activity", initialPlace, tripZone, tripID, tripStart, tripEnd, tripStartsAt, tripEndsAt, onSubmit, onCancel, onDirty, pending, error }: {
  initialValue?: ActivityInput & { id?: number }; initialPlace?: Place | null; tripZone: string; tripID: number;
  initialDate?: string; initialStartsAt?: string; initialCategory?: string; titleRef?: Ref<HTMLInputElement>;
  tripStart: string; tripEnd: string; tripStartsAt: string | null; tripEndsAt: string | null; onSubmit: (input: ActivityInput) => void;
  onCancel: () => void; onDirty?: () => void; pending: boolean; error: unknown;
}) {
  const prefix = useId();
  const api = useApi();
  const [title, setTitle] = useState(initialValue?.title ?? "");
  const [notes, setNotes] = useState(initialValue?.notes ?? "");
  const savedCategory = initialValue?.category ?? initialCategory;
  const [categoryChoice, setCategoryChoice] = useState<string>(activityCategories.some((category) => category === savedCategory) ? savedCategory : "custom");
  const [customCategory, setCustomCategory] = useState(categoryChoice === "custom" ? savedCategory : "");
  const checklistKey = useRef(initialValue?.checklist?.length ?? 0);
  const checklistAddButton = useRef<HTMLButtonElement>(null);
  const [checklist, setChecklist] = useState(() => (initialValue?.checklist ?? []).map((item, key) => ({ ...item, key })));
  const [startTime, setStartTime] = useState(() => initialValue ? instantToLocal(initialValue.starts_at, tripZone) : initialStartsAt ? instantToLocal(initialStartsAt, tripZone) : { value: initialDate ? `${initialDate}T` : "", occurrence: "" as Occurrence });
  const [duration, setDuration] = useState<Duration>(() => {
    if (!initialValue) return "60";
    const minutes = Number((Temporal.Instant.from(initialValue.ends_at).epochNanoseconds - Temporal.Instant.from(initialValue.starts_at).epochNanoseconds) / BigInt(60_000_000_000));
    return String(minutes) in durations && Temporal.Instant.from(initialValue.starts_at).add({ minutes }).equals(Temporal.Instant.from(initialValue.ends_at)) ? String(minutes) as Duration : "custom";
  });
  const [customHours, setCustomHours] = useState(() => initialValue
    ? String(Temporal.Instant.from(initialValue.starts_at).until(initialValue.ends_at).total("hours")) : "");
  const [timeChanged, setTimeChanged] = useState(false);
  const [validationError, setValidationError] = useState<string>();
  const [place, setPlace] = useState<Place | null>(initialPlace ?? null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceCandidate[] | null>(null);
  const [placeError, setPlaceError] = useState<unknown>(null);
  const [placePending, setPlacePending] = useState(false);
  let interval: { start: string; end: string } | null = null;
  let intervalError: unknown;
  try {
    const start = initialValue && !timeChanged ? initialValue.starts_at : localToInstant(startTime.value, tripZone, startTime.occurrence);
    const hours = Number(customHours);
    if (duration === "custom" && (!Number.isFinite(hours) || hours <= 0)) throw new Error("Enter a duration greater than 0 hours.");
    const end = initialValue && !timeChanged ? initialValue.ends_at : duration === "custom"
      ? Temporal.Instant.from(start).add({ milliseconds: Math.round(hours * 3_600_000) }).toString()
      : endAfterMinutes(start, durations[duration]);
    if (Temporal.Instant.compare(end, start) <= 0) throw new Error("Activity end must be after start.");
    interval = { start, end };
  } catch (cause) { intervalError = cause; }
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
      if (!interval) throw intervalError;
      const category = (categoryChoice === "custom" ? customCategory : categoryChoice).trim();
      const bytes = (value: string) => new TextEncoder().encode(value).length;
      if (!category || bytes(category) > 100) throw new Error("Enter a short category name.");
      if (checklist.length > 50) throw new Error("Use at most 50 to-do items.");
      if (checklist.some((item) => !item.text.trim() || bytes(item.text.trim()) > 200)) throw new Error("Give every to-do item a short description.");
      const input: ActivityInput = {
        title, notes, time_zone: tripZone, place_id: place?.id ?? null,
        category, checklist: checklist.map((item): ChecklistItem => ({ text: item.text.trim(), done: item.done })),
        starts_at: interval.start,
        ends_at: interval.end,
      };
      if (tripStartsAt && (Temporal.Instant.compare(input.starts_at, tripStartsAt) < 0 || Temporal.Instant.compare(input.ends_at, tripEndsAt!) > 0)) throw new Error("Activity must fit within the trip's start and end times.");
      if (!tripStartsAt && (startTime.value.slice(0, 10) < tripStart || instantToLocal(input.ends_at, tripZone).value.slice(0, 10) > tripEnd)) throw new Error("Activity dates must fit within the trip dates.");
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

  return <form onSubmit={submit} onChangeCapture={onDirty} className="activity-form space-y-5">
    <fieldset disabled={pending || placePending} className="min-w-0 space-y-5">
      <div className="space-y-2"><Label htmlFor={`${prefix}-title`}>What are you doing?</Label>
        <Input ref={titleRef} placeholder="e.g. Dinner at the waterfront" id={`${prefix}-title`} className="min-h-11" required value={title} onChange={(event) => setTitle(event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-category`}>Category</Label>
        <Select value={categoryChoice} onValueChange={(value) => { if (value !== null) { setCategoryChoice(value); onDirty?.(); } }}>
          <SelectTrigger id={`${prefix}-category`} className="min-h-11 w-full"><SelectValue>{categoryChoice === "custom" ? "Custom" : categoryChoice}</SelectValue></SelectTrigger>
          <SelectContent>{activityCategories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}<SelectItem value="custom">Custom</SelectItem></SelectContent>
        </Select>
        {categoryChoice === "custom" && <div className="space-y-2">
          <Label htmlFor={`${prefix}-custom-category`}>Custom category</Label>
          <Input id={`${prefix}-custom-category`} required value={customCategory} placeholder="e.g. Shopping" onChange={(event) => setCustomCategory(event.target.value)} />
          <p className="text-sm text-muted-foreground">This label belongs to this activity.</p>
        </div>}
      </div>
      <div className="form-section space-y-5">
        <DateTimeField id={`${prefix}-start`} label="Start" zone={tripZone} draft={startTime} split hideDate={!!initialDate && !initialValue}
          minDate={tripStart} maxDate={tripEnd} disabled={pending}
          onChange={(next) => { setStartTime(next); setTimeChanged(true); setValidationError(undefined); onDirty?.(); }} />
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-duration`}>Duration</Label>
          <Select value={duration} onValueChange={(value) => { if (value === "30" || value === "60" || value === "120" || value === "custom") { setDuration(value); setTimeChanged(true); setValidationError(undefined); onDirty?.(); } }}>
            <SelectTrigger id={`${prefix}-duration`} className="min-h-11 w-full"><SelectValue>{duration === "30" ? "30 minutes" : duration === "60" ? "1 hour" : duration === "120" ? "2 hours" : "Custom duration"}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 minutes</SelectItem><SelectItem value="60">1 hour</SelectItem>
              <SelectItem value="120">2 hours</SelectItem><SelectItem value="custom">Custom duration</SelectItem>
            </SelectContent>
          </Select>
          {duration === "custom" && <div className="space-y-2">
            <Label htmlFor={`${prefix}-custom-hours`}>Duration (hours)</Label>
            <Input id={`${prefix}-custom-hours`} type="number" min="0" step="any" inputMode="decimal" required
              aria-describedby={`${prefix}-custom-hours-help`} value={customHours} placeholder="e.g. 1.5"
              onChange={(event) => { setCustomHours(event.target.value); setTimeChanged(true); setValidationError(undefined); }} />
            <p id={`${prefix}-custom-hours-help`} className="text-sm text-muted-foreground">Enter the number of hours, e.g. 1.5 for 1 hour 30 minutes.</p>
          </div>}
          {interval && <p className="text-sm text-muted-foreground">Ends {formatEndTime(interval.end, tripZone, startTime.value.slice(0, 10))}</p>}
        </div>
      </div>
      {interval && (overlaps.isPending ? <p role="status" className="text-sm">Checking other activities…</p> : overlaps.isError ?
        <TripError error={overlaps.error} retry={() => void overlaps.refetch()} /> : overlaps.data && overlaps.data.length > 0 ?
          <Alert><AlertDescription>Overlaps {overlaps.data.map((item) => item.title).join(", ")}. Parallel activities are allowed.</AlertDescription></Alert> : null)}
      <div className="form-section space-y-3">
            <Label htmlFor={`${prefix}-place-search`}>Place (optional)</Label>
            {place && <div className="rounded-xl border bg-secondary/40 p-4 text-sm">
              <p className="font-medium">{place.name}</p><p className="break-words text-muted-foreground">{place.address}</p>
              <Button type="button" variant="outline" className="mt-2 min-h-11" onClick={() => { setPlace(null); onDirty?.(); }}>Clear place</Button>
            </div>}
            <div className="flex flex-wrap gap-2">
              <Input id={`${prefix}-place-search`} className="min-h-11 min-w-0 flex-1" value={query} onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); void search(); } }} placeholder="Search for a place" enterKeyHint="search" />
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
      <div className="form-section space-y-3" role="group" aria-labelledby={`${prefix}-checklist-label`}>
        <p id={`${prefix}-checklist-label`} className="font-medium">To do (optional)</p>
        <p className="text-sm text-muted-foreground">A simple list of things to do during this activity.</p>
        <ol className="space-y-3">{checklist.map((item, index) => <li key={item.key} className="flex flex-wrap items-center gap-2">
          <Input className="min-h-11 min-w-0 flex-1 basis-32" aria-label={`To-do item ${index + 1}`} required value={item.text} placeholder="e.g. Buy tickets"
            onChange={(event) => setChecklist(checklist.map((current) => current.key === item.key ? { ...current, text: event.target.value } : current))} />
          <Button type="button" variant="ghost" className="min-h-11" aria-label={`Remove to-do item ${index + 1}`}
            onClick={() => { setChecklist(checklist.filter((current) => current.key !== item.key)); onDirty?.(); requestAnimationFrame(() => checklistAddButton.current?.focus()); }}>Remove</Button>
        </li>)}</ol>
        <Button ref={checklistAddButton} type="button" variant="outline" className="min-h-11" disabled={checklist.length >= 50}
          onClick={() => { setChecklist([...checklist, { key: checklistKey.current++, text: "", done: false }]); onDirty?.(); }}>Add to-do item</Button>
        <p className="text-xs text-muted-foreground">{checklist.length}/50 items</p>
      </div>
      <details className="rounded-xl border p-4" open={!!initialValue?.notes}>
        <summary className="min-h-11 cursor-pointer py-3 font-medium">Notes (optional)</summary>
        <div className="mt-4 space-y-4">
          <div className="space-y-2"><Label htmlFor={`${prefix}-notes`}>Activity notes</Label>
            <textarea id={`${prefix}-notes`} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)}
              className="w-full min-w-0 rounded-lg border border-input bg-card px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50" />
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
