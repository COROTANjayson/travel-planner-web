"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { FunnelSimpleIcon } from "@phosphor-icons/react";
import { prepChipClass } from "@/components/features/prep/prep-select";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { monthDay } from "@/lib/activity-time";

export function ExpenseFilters<F extends string>({
  options,
  value,
  onChange,
  selectedRef,
}: {
  options: Record<F, string>;
  value: F;
  onChange: (value: F) => void;
  selectedRef?: RefObject<HTMLButtonElement | null>;
}) {
  const mobile = useRef<HTMLButtonElement | null>(null);
  const desktop = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!selectedRef) return;
    const wide = window.matchMedia("(min-width: 768px)");
    const sync = () => {
      selectedRef.current = wide.matches ? desktop.current : mobile.current;
    };
    sync();
    wide.addEventListener("change", sync);
    return () => wide.removeEventListener("change", sync);
  }, [selectedRef, value]);
  return (
    <>
      <div className="min-w-0 md:hidden">
        <Select
          value={value}
          onValueChange={(next) => {
            if (next !== null && Object.hasOwn(options, next))
              onChange(next as F);
          }}
        >
          <SelectTrigger
            ref={mobile}
            aria-label={`Filter expenses: ${options[value]}`}
            className="w-full gap-3 rounded-xl border-border bg-card px-3.5 text-sm"
          >
            <FunnelSimpleIcon
              aria-hidden="true"
              className="text-muted-foreground"
            />
            <span className="text-muted-foreground">Show</span>
            <SelectValue className="font-semibold text-foreground">
              {options[value]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="start" alignItemWithTrigger={false}>
            {(Object.keys(options) as F[]).map((option) => (
              <SelectItem
                key={option}
                value={option}
                className="min-h-11 px-3 text-base"
              >
                {options[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <nav
        aria-label="Filter expenses"
        className="hidden flex-wrap gap-1.5 md:flex"
      >
        {(Object.keys(options) as F[]).map((option) => (
          <Button
            key={option}
            ref={option === value ? desktop : undefined}
            type="button"
            variant="ghost"
            className={prepChipClass}
            aria-pressed={option === value}
            onClick={() => onChange(option)}
          >
            {options[option]}
          </Button>
        ))}
      </nav>
    </>
  );
}

/** Nothing recorded yet, or nothing in the selected filter. */
export function ExpenseEmpty({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid justify-items-center gap-3 rounded-[16px] border bg-card px-5 py-8 text-center">
      <p className="text-base leading-[22px] font-semibold">{title}</p>
      <p className="max-w-[280px] text-sm leading-5 text-muted-foreground">
        {detail}
      </p>
      {action}
    </div>
  );
}

export function ExpenseListLoading({ label }: { label: string }) {
  return (
    <div role="status" className="grid gap-4">
      <span className="sr-only">{label}</span>
      <div className="h-24 animate-pulse rounded-[16px] bg-muted motion-reduce:animate-none" />
      <div className="h-64 animate-pulse rounded-[16px] bg-muted motion-reduce:animate-none" />
    </div>
  );
}

export const expenseListClass =
  "overflow-hidden rounded-[16px] border bg-card [&>li+li]:border-t";

/** Covers the row so the whole row opens its details; other controls sit above it. */
export const rowButtonClass =
  "absolute inset-0 cursor-pointer outline-none hover:bg-primary/5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset max-md:scroll-mt-[calc(var(--app-top)+12px)] max-md:scroll-mb-[calc(var(--app-bottom)+12px)]";

/** "Nov" over "13" beside a row from md up. */
export function RowDate({ date }: { date: string }) {
  const { month, day } = monthDay(date);
  return (
    <time
      dateTime={date}
      className="hidden w-9 text-center text-[13px] leading-5 text-muted-foreground [grid-area:date] md:block"
    >
      {month}
      <br />
      {day}
    </time>
  );
}

/** Two labelled amounts in a drawer; a very large one takes its own line. */
export function DetailTotals({ items }: { items: [string, string][] }) {
  return (
    <dl className="flex flex-wrap gap-4 rounded-[16px] bg-secondary p-4">
      {items.map(([label, value]) => (
        <div key={label} className="max-w-full flex-[1_1_calc(50%-0.5rem)]">
          <dt className="text-sm leading-[22px] text-muted-foreground">
            {label}
          </dt>
          <dd className="mt-1 text-[22px] leading-[30px] font-semibold tabular-nums [overflow-wrap:break-word]">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** The activity's current title, its last title once removed, or no activity. */
export const activityPlace = (
  record: { activity_id?: number; activity_name?: string },
  activities: { id: number; title: string }[],
) =>
  record.activity_id
    ? (activities.find((a) => a.id === record.activity_id)?.title ??
      record.activity_name ??
      "Activity")
    : record.activity_name
      ? `${record.activity_name} (removed)`
      : "No activity";
