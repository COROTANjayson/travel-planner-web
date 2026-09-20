"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { tripInput, validateTrip, type TripInput } from "@/lib/trips";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TripError } from "./trip-states";

const emptyTrip: TripInput = {
  name: "", destination: "", start_date: "", end_date: "", time_zone: "",
};

export function TripForm({ initialValue = emptyTrip, onSubmit, pending, error, submitLabel, cancel }: {
  initialValue?: TripInput;
  onSubmit: (input: TripInput) => void;
  pending: boolean;
  error: unknown;
  submitLabel: string;
  cancel: ReactNode;
}) {
  const [values, setValues] = useState<TripInput>(() => tripInput(initialValue));
  const [validationError, setValidationError] = useState<string>();
  const [zones] = useState(() => typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone") : null);

  const options = zones && Array.from(new Set([
    ...(values.time_zone ? [values.time_zone] : []), ...zones,
  ])).sort();

  function change(field: keyof TripInput, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setValidationError(undefined);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const input = tripInput(values);
    const message = validateTrip(input);
    setValidationError(message);
    if (!message) onSubmit(input);
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <fieldset disabled={pending} className="min-w-0 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="trip-name">Trip name</Label>
          <Input id="trip-name" name="name" className="min-h-11" required value={values.name}
            onChange={(event) => change("name", event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="trip-destination">Destination</Label>
          <Input id="trip-destination" name="destination" className="min-h-11" required value={values.destination}
            onChange={(event) => change("destination", event.target.value)} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <Label htmlFor="trip-start">Start date</Label>
            <Input id="trip-start" name="start_date" type="date" className="min-h-11" required value={values.start_date}
              onChange={(event) => change("start_date", event.target.value)} />
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="trip-end">End date</Label>
            <Input id="trip-end" name="end_date" type="date" className="min-h-11" required
              min={values.start_date || undefined} value={values.end_date}
              onChange={(event) => change("end_date", event.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="trip-zone">Time zone</Label>
          {options ? (
            <Select name="time_zone" required disabled={pending} value={values.time_zone || null}
              onValueChange={(value) => change("time_zone", value ?? "")}>
              <SelectTrigger id="trip-zone" className="min-h-11 w-full">
                <SelectValue placeholder="Select a time zone" />
              </SelectTrigger>
              <SelectContent>
                {options.map((zone) => <SelectItem key={zone} value={zone} className="min-h-11">{zone}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <Input id="trip-zone" name="time_zone" className="min-h-11" required
              placeholder="Asia/Manila" value={values.time_zone}
              onChange={(event) => change("time_zone", event.target.value)} />
          )}
        </div>
      </fieldset>
      {validationError && <Alert variant="destructive"><AlertDescription>{validationError}</AlertDescription></Alert>}
      {!!error && <TripError error={error} />}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" className="min-h-11" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        {cancel}
      </div>
    </form>
  );
}
