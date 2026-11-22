"use client";

import {
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type WheelEvent,
} from "react";
import { cn } from "@/lib/utils";

// Pixels of drag per one-row step (about one wheel row).
const DRAG_ROW = 30;

type Column = "hour" | "minute" | "period";
const pad = (n: number) => String(n).padStart(2, "0");
const mod = (n: number, m: number) => ((n % m) + m) % m;

// Moves one column of a 24h "HH:MM" by `step` without carrying into the others.
export function shift(
  hours: number,
  minutes: number,
  column: Column,
  step: number,
) {
  if (column === "hour") hours = mod(hours + step, 12) + (hours >= 12 ? 12 : 0);
  if (column === "minute") minutes = mod(minutes + step * 5, 60);
  if (column === "period") hours = mod(hours + 12 * step, 24);
  return `${pad(hours)}:${pad(minutes)}`;
}

/** Inline time picker that opens under a time field (Figma "Time wheel"). */
export function TimeWheel({
  value,
  onChange,
  onDone,
}: {
  value: string;
  onChange: (time: string) => void;
  onDone: () => void;
}) {
  const [hours, minutes] = /^\d{2}:\d{2}$/.test(value)
    ? value.split(":").map(Number)
    : [9, 0];
  const pm = hours >= 12;
  const label = (column: Column, offset: number) => {
    if (column === "hour") return String(mod(hours + offset - 1, 12) + 1);
    if (column === "minute") return pad(mod(minutes + offset * 5, 60));
    if (offset === 0) return pm ? "PM" : "AM";
    return offset === (pm ? -1 : 1) ? (pm ? "AM" : "PM") : "";
  };
  const step = (column: Column, by: number) =>
    onChange(shift(hours, minutes, column, by));
  const keys = (column: Column) => (event: KeyboardEvent) => {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      step(column, event.key === "ArrowUp" ? -1 : 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      onDone();
    }
  };
  const scroll = (column: Column) => (event: WheelEvent) => {
    if (event.deltaY) step(column, Math.sign(event.deltaY));
  };
  // Drag a column up or down to scroll it. Steps are counted from the value at
  // pointerdown, so fast moves between renders never read a stale time.
  const drag = useRef<{
    column: Column;
    y: number;
    hours: number;
    minutes: number;
  } | null>(null);
  const dragged = useRef(false);
  const dragProps = (column: Column) => ({
    onPointerDown: (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { column, y: event.clientY, hours, minutes };
      dragged.current = false;
    },
    onPointerMove: (event: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const steps = -Math.round((event.clientY - d.y) / DRAG_ROW);
      if (steps) dragged.current = true;
      if (!dragged.current) return;
      const next = shift(d.hours, d.minutes, d.column, steps);
      if (next !== value) onChange(next);
    },
    onPointerUp: () => (drag.current = null),
    onPointerCancel: () => (drag.current = null),
    // A drag must not also count as a click on the row it ends on.
    onClickCapture: (event: MouseEvent) => {
      if (!dragged.current) return;
      dragged.current = false;
      event.stopPropagation();
      event.preventDefault();
    },
  });
  const names = { hour: "Hour", minute: "Minute", period: "AM or PM" };
  return (
    <div className="flex touch-none flex-col gap-0.5 rounded-xl border border-border bg-card p-3 select-none">
      {[-2, -1, 0, 1, 2].map((offset) => {
        const selected = offset === 0;
        return (
          <div
            key={offset}
            className={cn(
              "flex items-center justify-center gap-6 rounded-lg py-0.5",
              selected && "bg-muted py-2",
              Math.abs(offset) === 1 && "opacity-55",
              Math.abs(offset) === 2 && "opacity-30",
            )}
          >
            {(["hour", "minute", "period"] as const).map((column) => {
              const text = label(column, offset);
              return selected ? (
                <span
                  key={column}
                  role="spinbutton"
                  tabIndex={0}
                  aria-label={names[column]}
                  aria-valuetext={text}
                  onKeyDown={keys(column)}
                  onWheel={scroll(column)}
                  {...dragProps(column)}
                  className="w-14 cursor-grab rounded-md text-center text-[22px] leading-[30px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {text}
                </span>
              ) : (
                <button
                  key={column}
                  type="button"
                  tabIndex={-1}
                  aria-hidden="true"
                  disabled={!text}
                  // Keeps focus (and Escape) in the time field.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => step(column, column === "period" ? 1 : offset)}
                  onWheel={scroll(column)}
                  {...dragProps(column)}
                  className="w-14 cursor-grab text-center text-lg leading-[26px] font-semibold text-muted-foreground"
                >
                  {text || " "}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
