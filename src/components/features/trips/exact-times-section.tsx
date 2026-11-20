"use client";

import type { Dispatch, SetStateAction } from "react";
import type { Destination } from "@/components/features/trips/trip-form";
import {
  DateTimeField,
  type LocalDraft,
} from "@/components/shared/date-time-field";
import { Label } from "@/components/ui/label";

export function ExactTimesSection({
  fieldsOnly,
  exactTimes,
  setExactTimes,
  destination,
  times,
  setTimes,
  pending,
  setValidationError,
}: {
  fieldsOnly?: boolean;
  exactTimes: boolean;
  setExactTimes: (exact: boolean) => void;
  destination: Destination | null;
  times: { start: LocalDraft; end: LocalDraft };
  setTimes: Dispatch<SetStateAction<{ start: LocalDraft; end: LocalDraft }>>;
  pending: boolean;
  setValidationError: (error: string | undefined) => void;
}) {
  return (
    <div className={fieldsOnly ? "space-y-3" : "optional-times space-y-3"}>
      {!fieldsOnly && (
        <Label className="flex min-h-11 cursor-pointer items-center gap-3 leading-6">
          <input
            type="checkbox"
            className="size-5 shrink-0 accent-primary"
            checked={exactTimes}
            onChange={(event) => {
              setExactTimes(event.target.checked);
              setValidationError(undefined);
            }}
          />
          Add arrival and departure times (optional)
        </Label>
      )}
      {!exactTimes && (
        <p className="text-sm text-muted-foreground">
          Dates are enough to get started. Add exact times later if you need
          them.
        </p>
      )}
      {exactTimes && !destination && (
        <p className="text-sm text-muted-foreground">
          Choose a destination to enter times in its local time zone.
        </p>
      )}
      {exactTimes && destination && (
        <div
          className={
            fieldsOnly
              ? "grid grid-cols-2 gap-2.5 md:gap-4"
              : "grid gap-5 sm:grid-cols-2"
          }
        >
          <DateTimeField
            id="trip-start"
            label={fieldsOnly ? "Arrive" : "Start"}
            split
            hideDate
            zone={destination.time_zone}
            draft={times.start}
            disabled={pending}
            onChange={(start) => {
              setTimes((current) => ({ ...current, start }));
              setValidationError(undefined);
            }}
          />
          <DateTimeField
            id="trip-end"
            label={fieldsOnly ? "Leave" : "End"}
            split
            hideDate
            zone={destination.time_zone}
            draft={times.end}
            disabled={pending}
            onChange={(end) => {
              setTimes((current) => ({ ...current, end }));
              setValidationError(undefined);
            }}
          />
        </div>
      )}
    </div>
  );
}
