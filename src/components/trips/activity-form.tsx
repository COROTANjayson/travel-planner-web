"use client";

import { useId, useState, type FormEvent } from "react";
import { type ActivityInput } from "@/lib/itinerary";
import { dateTimeInputValue, instantToLocal, inspectLocalTime, localToInstant, type Occurrence } from "@/lib/activity-time";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TripError } from "./trip-states";

export function ActivityForm({ initialValue, tripZone, onSubmit, onCancel, pending, error }: {
  initialValue?: ActivityInput; tripZone: string; onSubmit: (input: ActivityInput) => void;
  onCancel: () => void; pending: boolean; error: unknown;
}) {
  const prefix = useId();
  const [title, setTitle] = useState(initialValue?.title ?? "");
  const [notes, setNotes] = useState(initialValue?.notes ?? "");
  const [zone, setZone] = useState(initialValue?.time_zone ?? tripZone);
  const [zoneDraft, setZoneDraft] = useState(zone);
  const [times, setTimes] = useState(() => ({
    start: initialValue ? instantToLocal(initialValue.starts_at, initialValue.time_zone) : { value: "", occurrence: "" as Occurrence },
    end: initialValue ? instantToLocal(initialValue.ends_at, initialValue.time_zone) : { value: "", occurrence: "" as Occurrence },
  }));
  const [validationError, setValidationError] = useState<string>();
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
    if (pending) return;
    try {
      if (zoneDraft !== zone) throw new Error("Apply the selected time zone before saving.");
      const input: ActivityInput = {
        title, notes, time_zone: zone,
        starts_at: localToInstant(times.start.value, zone, times.start.occurrence),
        ends_at: localToInstant(times.end.value, zone, times.end.occurrence),
      };
      setValidationError(undefined);
      onSubmit(input);
    } catch (cause) {
      setValidationError(cause instanceof Error ? cause.message : "Check the activity times.");
    }
  }

  return <form onSubmit={submit} className="space-y-5">
    <fieldset disabled={pending} className="min-w-0 space-y-5">
      <div className="space-y-2"><Label htmlFor={`${prefix}-title`}>Activity title</Label>
        <Input id={`${prefix}-title`} className="min-h-11" required value={title} onChange={(event) => setTitle(event.target.value)} />
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
      <Button type="submit" className="min-h-11" disabled={pending}>{pending ? "Saving…" : initialValue ? "Save activity" : "Create activity"}</Button>
      <Button type="button" variant="outline" className="min-h-11" disabled={pending} onClick={onCancel}>Cancel</Button>
    </div>
  </form>;
}
