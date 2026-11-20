"use client";

import { useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDotsIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { TripDialog } from "@/components/shared/trip-dialog";
import { fieldRequired } from "@/components/shared/field-required";
import { formatTripDates, tripDayCount } from "@/lib/trips";

type Dates = { start: string; end: string };

export function TripRangeFields({
  dates,
  onChange,
}: {
  dates: Dates;
  onChange: (dates: Dates) => void;
}) {
  const [picker, setPicker] = useState<"sheet" | "inline" | null>(null);
  const [draft, setDraft] = useState(dates);
  const [pickingEnd, setPickingEnd] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const reversed = !!dates.end && dates.end < dates.start;
  const validDraft = !!draft.start && draft.end >= draft.start;
  const calendarDate = (pickingEnd && dates.end) || dates.start;

  function close() {
    setPicker(null);
    trigger.current?.focus();
  }

  const calendar = picker && (
    <>
      <Calendar
        autoFocus
        aria-label="Trip dates"
        mode="range"
        numberOfMonths={1}
        showOutsideDays={false}
        defaultMonth={calendarDate ? parseISO(calendarDate) : undefined}
        selected={
          draft.start
            ? {
                from: parseISO(draft.start),
                to: validDraft ? parseISO(draft.end) : undefined,
              }
            : undefined
        }
        onDayClick={(day) => {
          const date = format(day, "yyyy-MM-dd");
          setDraft(
            pickingEnd ? { ...draft, end: date } : { ...draft, start: date },
          );
          setPickingEnd(true);
        }}
        className="mx-auto max-w-full bg-transparent [--cell-size:clamp(2rem,9vw,2.75rem)]"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {validDraft
            ? `${formatTripDates(draft.start, draft.end)} · ${tripDayCount(draft.start, draft.end)} days`
            : draft.end
              ? "End date must be on or after the start date."
              : "Tap your first day, then your last."}
        </p>
        <div className="ml-auto flex gap-2">
          {picker === "inline" && (
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
          )}
          <Button
            type="button"
            disabled={!validDraft}
            onClick={() => {
              onChange(draft);
              close();
            }}
          >
            Done
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2.5 md:gap-4">
        {(["start", "end"] as const).map((field) => (
          <div key={field} className="min-w-0 space-y-2">
            <span
              id={`trip-range-${field}-label`}
              className={`text-sm font-medium ${fieldRequired}`}
            >
              {field === "start" ? "Start" : "End"}
            </span>
            <Button
              id={`trip-range-${field}`}
              type="button"
              variant="outline"
              aria-labelledby={`trip-range-${field}-label trip-range-${field}-value`}
              aria-expanded={picker !== null}
              aria-invalid={field === "end" && reversed}
              aria-describedby={
                field === "end" && reversed ? "trip-range-error" : undefined
              }
              className="h-auto min-h-12 w-full justify-start rounded-lg border-input px-2.5 text-left whitespace-normal aria-invalid:border-destructive"
              onClick={(event) => {
                trigger.current = event.currentTarget;
                if (picker) {
                  close();
                  return;
                }
                setDraft(dates);
                setPickingEnd(field === "end" && !!dates.start);
                setPicker(
                  window.matchMedia("(min-width: 768px)").matches
                    ? "inline"
                    : "sheet",
                );
              }}
            >
              <CalendarDotsIcon aria-hidden="true" className="shrink-0" />
              <span id={`trip-range-${field}-value`}>
                {dates[field]
                  ? formatTripDates(dates[field], dates[field])
                  : "Pick a date"}
              </span>
            </Button>
          </div>
        ))}
      </div>
      {reversed && (
        <p
          role="alert"
          id="trip-range-error"
          className="text-sm text-destructive"
        >
          End date must be on or after the start date.
        </p>
      )}
      {picker === "inline" && (
        <div
          className="space-y-4 rounded-xl border bg-card p-4"
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
          }}
        >
          {calendar}
        </div>
      )}
      {picker === "sheet" && (
        <TripDialog
          title="When are you going?"
          description="Tap your first day, then your last."
          mobilePresentation="sheet"
          open
          onOpenChange={(open) => {
            if (!open) close();
          }}
          finalFocus={trigger}
          bodyClassName="space-y-4 p-4"
        >
          {calendar}
        </TripDialog>
      )}
    </div>
  );
}
