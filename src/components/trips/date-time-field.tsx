"use client";

import { useState } from "react";
import { TZDate } from "react-day-picker";
import { CalendarDays } from "lucide-react";
import { inspectLocalTime, type Occurrence } from "@/lib/activity-time";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TripDialog } from "./trip-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type LocalDraft = { value: string; occurrence: Occurrence };
const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

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
}) {
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
          <Label htmlFor={`${id}-date`}>
            {split ? `${label} date` : `${label} date and time`}
          </Label>
          <TripDialog
            title={`Choose ${label.toLowerCase()} date`}
            description={`Times in ${zone}.`}
            mobilePresentation="sheet"
            open={open}
            onOpenChange={setOpen}
            trigger={
              <Button
                id={`${id}-date`}
                type="button"
                variant="outline"
                disabled={disabled}
                className="min-h-11 w-full justify-start font-normal"
              >
                <CalendarDays className="size-4" />
                {date
                  ? `${date}${split ? "" : ` ${time || "Choose time"}`}`
                  : split
                    ? "Choose date"
                    : "Choose date and time"}
              </Button>
            }
          >
            <div className="flex flex-col items-center">
              <Calendar
                mode="single"
                timeZone={zone}
                selected={selected}
                defaultMonth={selected}
                captionLayout="dropdown"
                disabled={(day) =>
                  (minDate !== undefined && dateKey(day) < minDate) ||
                  (maxDate !== undefined && dateKey(day) > maxDate)
                }
                onSelect={(day) => {
                  if (!day) return;
                  onChange({
                    value: `${dateKey(day)}T${draft.value.includes("T") ? draft.value.split("T")[1] : ""}`,
                    occurrence: "",
                  });
                  if (split) setOpen(false);
                }}
              />
              {!split && (
                <div className="space-y-2 border-t p-3">
                  <Label htmlFor={`${id}-time`}>{label} time</Label>
                  <Input
                    id={`${id}-time`}
                    type="time"
                    className="min-h-11"
                    disabled={disabled || !date}
                    value={time}
                    onChange={(event) =>
                      onChange({
                        value: date ? `${date}T${event.target.value}` : "",
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
                              {choice.occurrence === "earlier"
                                ? "Earlier"
                                : "Later"}{" "}
                              (UTC{choice.offset})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Button
                    type="button"
                    className="w-full"
                    disabled={
                      !time ||
                      inspected.choices.length === 0 ||
                      (inspected.choices.length === 2 && !draft.occurrence)
                    }
                    onClick={() => setOpen(false)}
                  >
                    Done
                  </Button>
                </div>
              )}
            </div>
          </TripDialog>
        </div>
      )}
      {split && (
        <div className="min-w-0 space-y-2">
          <Label htmlFor={`${id}-time`}>{label} time</Label>
          <Input
            id={`${id}-time`}
            type="time"
            className="min-h-11"
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
