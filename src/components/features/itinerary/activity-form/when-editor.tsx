"use client";

import { cn } from "@/lib/utils";
import { fieldRequired } from "@/components/shared/field-required";
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

const durationLabels: Record<Duration, string> = {
  "30": "30 minutes",
  "60": "1 hour",
  "120": "2 hours",
  custom: "Custom duration",
};

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
          hideDate ? "sr-only" : "mb-2 block text-sm leading-5 font-medium"
        }
      >
        {hideDate ? fullDateLabel(initialDate!) : "When"}
      </p>
      {/* Start time and Duration share a row on desktop (Figma "When"). */}
      <div
        className={cn(
          "space-y-5",
          planning && "grid items-start gap-4 space-y-0 md:grid-cols-2",
        )}
      >
        {/* The edit form's date trigger matches the 48px Figma input. */}
        <div className="min-w-0 space-y-2 [&_button[id$='-date']]:min-h-12 [&_button[id$='-date']]:rounded-lg">
          <DateTimeField
            id={`${prefix}-start`}
            label="Start"
            zone={tripZone}
            draft={startTime}
            split
            required
            timeWheel
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
          <p className="text-[13px] leading-5 wrap-break-word text-muted-foreground">
            {whenSummary}
          </p>
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor={`${prefix}-duration`} className={fieldRequired}>
            Duration
          </Label>
          <Select
            value={duration}
            onValueChange={(value) => {
              if (value && value in durationLabels) {
                setDuration(value as Duration);
                setTimeChanged(true);
                setValidationError(undefined);
              }
            }}
          >
            <SelectTrigger
              id={`${prefix}-duration`}
              className="w-full md:data-[size=default]:min-h-12"
            >
              <SelectValue>{durationLabels[duration]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(durationLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {duration === "custom" && (
          <div className="min-w-0 space-y-2">
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
              className="md:min-h-12"
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
