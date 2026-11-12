"use client";

import { cn } from "@/lib/utils";
import { fieldRequired } from "@/components/shared/field-required";
import { Clock } from "lucide-react";
import type { Duration } from "@/components/features/itinerary/activity-form/activity-form";
import {
  DateTimeField,
  type LocalDraft,
} from "@/components/shared/date-time-field";
import { Input } from "@/components/ui/input";
import { fullDateLabel } from "@/lib/activity-time";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function WhenEditor({
  prefix,
  hideDate,
  initialDate,
  tripZone,
  tripStart,
  tripEnd,
  pending,
  startTime,
  setStartTime,
  setTimeChanged,
  setValidationError,
  whenSummary,
  duration,
  setDuration,
  customHours,
  setCustomHours,
  planning,
}: {
  prefix: string;
  hideDate: boolean;
  initialDate?: string;
  tripZone: string;
  tripStart: string;
  tripEnd: string;
  pending: boolean;
  startTime: LocalDraft;
  setStartTime: (next: LocalDraft) => void;
  setTimeChanged: (changed: boolean) => void;
  setValidationError: (error: string | undefined) => void;
  whenSummary: string;
  duration: Duration;
  setDuration: (duration: Duration) => void;
  customHours: string;
  setCustomHours: (hours: string) => void;
  planning: boolean;
}) {
  return (
    <div
      className="activity-when-editor"
      role="group"
      aria-labelledby={`${prefix}-when`}
    >
      <p
        id={`${prefix}-when`}
        className={
          hideDate
            ? "sr-only"
            : "mb-2 block text-sm leading-[22px] font-normal text-muted-foreground"
        }
      >
        {hideDate ? fullDateLabel(initialDate!) : "When"}
      </p>
      <div
        className={cn(
          "space-y-5",
          planning &&
            "grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] items-start gap-x-4 gap-y-0",
        )}
      >
        <div className="min-w-0 space-y-2">
          <DateTimeField
            id={`${prefix}-start`}
            label="Start"
            zone={tripZone}
            draft={startTime}
            split
            required
            hideDate={hideDate}
            minDate={tripStart}
            maxDate={tripEnd}
            disabled={pending}
            onChange={(next) => {
              setStartTime(next);
              setTimeChanged(true);
              setValidationError(undefined);
            }}
          />
          <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <Clock className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0 wrap-break-word">{whenSummary}</span>
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-duration`} className={fieldRequired}>
            Duration
          </Label>
          <Select
            value={duration}
            onValueChange={(value) => {
              if (
                value === "30" ||
                value === "60" ||
                value === "120" ||
                value === "custom"
              ) {
                setDuration(value);
                setTimeChanged(true);
                setValidationError(undefined);
              }
            }}
          >
            <SelectTrigger
              id={`${prefix}-duration`}
              className="min-h-11 w-full"
            >
              <SelectValue>
                {duration === "30"
                  ? "30 minutes"
                  : duration === "60"
                    ? "1 hour"
                    : duration === "120"
                      ? "2 hours"
                      : "Custom duration"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 minutes</SelectItem>
              <SelectItem value="60">1 hour</SelectItem>
              <SelectItem value="120">2 hours</SelectItem>
              <SelectItem value="custom">Custom duration</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {duration === "custom" && (
          <div className="space-y-2">
            <Label htmlFor={`${prefix}-custom-hours`} className={fieldRequired}>
              Duration (hours)
            </Label>
            <Input
              id={`${prefix}-custom-hours`}
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              required
              value={customHours}
              placeholder="e.g. 1.5"
              onChange={(event) => {
                setCustomHours(event.target.value);
                setTimeChanged(true);
                setValidationError(undefined);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
