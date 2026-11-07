"use client";

import { useState } from "react";
import { TZDate } from "react-day-picker";
import { inspectLocalTime, type Occurrence } from "@/lib/activity-time";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateTimePickerSheet } from "@/components/shared/date-time-picker-sheet";
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
}) {
  const labelClass = required ? "field-required" : undefined;
  const [open, setOpen] = useState(false);
  const date = draft.value.slice(0, 10);
  const [year, month, day] = date.split("-").map(Number);
  const selected = date ? new TZDate(year, month - 1, day, zone) : undefined;
  const time = draft.value.slice(11, 16);
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
          <Input
            id={`${id}-time`}
            type="time"
            className="min-h-11"
            required={required}
            disabled={disabled || !date}
            value={time}
            onChange={(event) =>
              onChange({
                value: `${date}T${event.target.value}`,
                occurrence: "",
              })
            }
          />
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
