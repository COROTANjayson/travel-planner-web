"use client";

import { fieldRequired } from "@/components/shared/field-required";
import { useState } from "react";
import { TZDate } from "react-day-picker";
import { inspectLocalTime, type Occurrence } from "@/lib/activity-time";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateTimePickerSheet } from "@/components/shared/date-time-picker-sheet";
import { TimeWheel } from "@/components/shared/time-wheel";
import { ClockIcon } from "@phosphor-icons/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type LocalDraft = { value: string; occurrence: Occurrence };

export function DateTimeField({
  id,
  label,
  zone,
  draft,
  onChange,
  minDate,
  maxDate,
  disabled,
  split = false,
  hideDate = false,
  required = false,
  timeWheel = false,
}: {
  id: string;
  label: string;
  zone: string;
  draft: LocalDraft;
  onChange: (draft: LocalDraft) => void;
  minDate?: string;
  maxDate?: string;
  disabled?: boolean;
  split?: boolean;
  hideDate?: boolean;
  required?: boolean;
  /** Clock icon in the time input and the inline time wheel under it. */
  timeWheel?: boolean;
}) {
  const labelClass = required ? fieldRequired : undefined;
  const [open, setOpen] = useState(false);
  const date = draft.value.slice(0, 10);
  const [year, month, day] = date.split("-").map(Number);
  const selected = date ? new TZDate(year, month - 1, day, zone) : undefined;
  const time = draft.value.slice(11, 16);
  const [wheelOpen, setWheelOpen] = useState(false);
  const setTime = (next: string) =>
    onChange({ value: `${date}T${next}`, occurrence: "" });
  const inspected: ReturnType<typeof inspectLocalTime> =
    draft.value.length >= 16
      ? inspectLocalTime(draft.value, zone)
      : { choices: [] };
  return (
    <div
      className={
        split && !hideDate
          ? "grid min-w-0 gap-x-4 gap-y-2 sm:grid-cols-2"
          : "min-w-0 space-y-2"
      }
    >
      {!hideDate && (
        <div className="min-w-0 space-y-2">
          <Label htmlFor={`${id}-date`} className={labelClass}>
            {split ? `${label} date` : `${label} date and time`}
          </Label>
          <DateTimePickerSheet
            id={id}
            label={label}
            zone={zone}
            draft={draft}
            onChange={onChange}
            minDate={minDate}
            maxDate={maxDate}
            disabled={disabled}
            split={split}
            open={open}
            setOpen={setOpen}
            date={date}
            time={time}
            selected={selected}
            inspected={inspected}
          />
        </div>
      )}
      {split && (
        <div className="min-w-0 space-y-2">
          <Label htmlFor={`${id}-time`} className={labelClass}>
            {label} time
          </Label>
          <div
            className="space-y-2"
            onFocus={() => timeWheel && setWheelOpen(true)}
            onKeyDown={(event) => {
              if (event.key !== "Escape" || !wheelOpen) return;
              event.stopPropagation();
              setWheelOpen(false);
            }}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget))
                setWheelOpen(false);
            }}
          >
            <div className="relative">
              {timeWheel && (
                <ClockIcon
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
              )}
              <Input
                id={`${id}-time`}
                type="time"
                className={
                  timeWheel
                    ? "pl-9 md:min-h-12 [&::-webkit-calendar-picker-indicator]:hidden"
                    : "min-h-11"
                }
                required={required}
                disabled={disabled || !date}
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </div>
            {wheelOpen && !disabled && date && (
              <TimeWheel
                value={time}
                onChange={setTime}
                onDone={() => setWheelOpen(false)}
              />
            )}
          </div>
          {inspected.error && (
            <p role="alert" className="text-sm text-destructive">
              {inspected.error}
            </p>
          )}
          {inspected.choices.length === 2 && (
            <div className="space-y-2">
              <Label htmlFor={`${id}-occurrence`}>
                {label} time occurrence
              </Label>
              <Select
                value={draft.occurrence || null}
                onValueChange={(value) => {
                  if (value === "earlier" || value === "later")
                    onChange({ ...draft, occurrence: value });
                }}
              >
                <SelectTrigger
                  id={`${id}-occurrence`}
                  className="min-h-11 w-full"
                >
                  <SelectValue placeholder="Choose an occurrence" />
                </SelectTrigger>
                <SelectContent>
                  {inspected.choices.map((choice) => (
                    <SelectItem
                      key={choice.occurrence}
                      value={choice.occurrence}
                    >
                      {choice.occurrence === "earlier" ? "Earlier" : "Later"}{" "}
                      (UTC{choice.offset})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
