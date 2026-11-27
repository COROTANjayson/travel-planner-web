"use client";

import { Combobox } from "@base-ui/react/combobox";
import { CaretDownIcon, CheckIcon } from "@phosphor-icons/react";
import { fieldRequired } from "@/components/shared/field-required";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dateLabel, localDate, timeLabel } from "@/lib/activity-time";
import type { Activity } from "@/lib/itinerary";

export type PickerActivity = Pick<Activity, "id" | "title" | "starts_at">;
type Option = { value: number; label: string; time?: string };
type Day = { value: string; items: Option[] };

/** Searchable activity list grouped by trip day; 0 means no activity. */
export function ActivityPicker({
  id,
  label = "Activity",
  activities,
  zone,
  value,
  onChange,
  required,
  disabled,
  placeholder,
}: {
  id: string;
  label?: string;
  activities: PickerActivity[];
  zone: string;
  value: number;
  onChange: (value: number) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  const today = localDate(new Date().toISOString(), zone);
  const days: Day[] = required
    ? []
    : [{ value: "", items: [{ value: 0, label: "No activity" }] }];
  for (const activity of activities) {
    const date = localDate(activity.starts_at, zone);
    const name = dateLabel(date) + (date === today ? " · Today" : "");
    let day = days.find((d) => d.value === name);
    if (!day) days.push((day = { value: name, items: [] }));
    day.items.push({
      value: activity.id,
      label: activity.title,
      time: timeLabel(activity.starts_at, zone),
    });
  }
  const selected =
    (value && days.flatMap((d) => d.items).find((o) => o.value === value)) ||
    null;
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id} className={required ? fieldRequired : undefined}>
        {label}
      </Label>
      <Combobox.Root<Option>
        items={days}
        value={selected}
        disabled={disabled}
        autoHighlight
        isItemEqualToValue={(a, b) => a.value === b.value}
        onValueChange={(next) => onChange(next?.value ?? 0)}
      >
        <div className="relative">
          <Combobox.Input
            id={id}
            placeholder={
              placeholder ?? (required ? "Choose an activity" : "No activity")
            }
            render={<Input className="min-h-12 pr-11" />}
          />
          <Combobox.Trigger
            aria-label={`Show choices for ${label}`}
            className="absolute inset-y-0 right-0 grid w-11 cursor-pointer place-items-center rounded-lg text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <CaretDownIcon aria-hidden="true" className="size-4" />
          </Combobox.Trigger>
        </div>
        <Combobox.Portal>
          <Combobox.Positioner
            align="start"
            sideOffset={4}
            className="isolate z-50"
          >
            <Combobox.Popup className="max-h-[min(22rem,var(--available-height))] w-(--anchor-width) overflow-y-auto overscroll-contain rounded-xl border bg-popover p-1 text-popover-foreground shadow-[0_8px_24px_rgba(18,60,64,0.12)] outline-none">
              <Combobox.Empty className="px-3 py-2.5 text-sm text-muted-foreground empty:hidden">
                No activities match.
              </Combobox.Empty>
              <Combobox.List>
                {(day: Day) => (
                  <Combobox.Group key={day.value} items={day.items}>
                    {day.value && (
                      <Combobox.GroupLabel className="px-3 pt-2.5 pb-1 text-xs leading-5 font-medium text-muted-foreground">
                        {day.value}
                      </Combobox.GroupLabel>
                    )}
                    <Combobox.Collection>
                      {(option: Option) => (
                        <Combobox.Item
                          key={option.value}
                          value={option}
                          className="flex min-h-11 cursor-pointer items-center gap-3 rounded-sm px-3 py-2.5 text-base leading-6 outline-none data-highlighted:bg-accent data-selected:font-medium"
                        >
                          <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                            {option.label}
                          </span>
                          {option.time && (
                            <span className="shrink-0 text-[13px] leading-5 font-normal text-muted-foreground">
                              {option.time}
                            </span>
                          )}
                          <Combobox.ItemIndicator className="shrink-0 text-primary">
                            <CheckIcon aria-hidden="true" className="size-4" />
                          </Combobox.ItemIndicator>
                        </Combobox.Item>
                      )}
                    </Combobox.Collection>
                  </Combobox.Group>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </div>
  );
}
