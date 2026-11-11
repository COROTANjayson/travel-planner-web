import { Temporal } from "@js-temporal/polyfill";

export type Occurrence = "" | "earlier" | "later";
export interface TimeChoice {
  instant: string;
  offset: string;
  occurrence: Exclude<Occurrence, "">;
}

// Native datetime inputs accept milliseconds; keep full precision in the draft.
export const dateTimeInputValue = (value: string) =>
  value.replace(/(\.\d{3})\d+$/, "$1");

export function inspectLocalTime(
  value: string,
  zone: string,
): { choices: TimeChoice[]; error?: string } {
  if (!value) return { choices: [] };
  try {
    const local = Temporal.PlainDateTime.from(value);
    const earlier = local.toZonedDateTime(zone, { disambiguation: "earlier" });
    const later = local.toZonedDateTime(zone, { disambiguation: "later" });
    if (
      !earlier.toPlainDateTime().equals(local) ||
      !later.toPlainDateTime().equals(local)
    ) {
      return {
        choices: [],
        error:
          "This local time does not exist because the clocks change. Choose another time.",
      };
    }
    const choices: TimeChoice[] = [
      {
        instant: earlier.toInstant().toString(),
        offset: earlier.offset,
        occurrence: "earlier",
      },
    ];
    if (earlier.epochNanoseconds !== later.epochNanoseconds) {
      choices.push({
        instant: later.toInstant().toString(),
        offset: later.offset,
        occurrence: "later",
      });
    }
    return { choices };
  } catch {
    return {
      choices: [],
      error: "Enter a valid local date and time and an IANA time zone.",
    };
  }
}

export function localToInstant(
  value: string,
  zone: string,
  occurrence: Occurrence = "",
): string {
  if (!value) throw new Error("Start and end times are required.");
  const { choices, error } = inspectLocalTime(value, zone);
  if (error) throw new Error(error);
  if (choices.length === 1) return choices[0].instant;
  const selected = choices.find((choice) => choice.occurrence === occurrence);
  if (!selected)
    throw new Error(
      "This local time occurs twice. Choose the earlier or later occurrence.",
    );
  return selected.instant;
}

export function instantToLocal(
  instant: string,
  zone: string,
): { value: string; occurrence: Occurrence } {
  const exact = Temporal.Instant.from(instant);
  const value = exact.toZonedDateTimeISO(zone).toPlainDateTime().toString();
  const { choices } = inspectLocalTime(value, zone);
  return {
    value,
    occurrence:
      choices.length === 2
        ? choices.find(
            (choice) => Temporal.Instant.compare(choice.instant, exact) === 0,
          )!.occurrence
        : "",
  };
}

export const endAfterMinutes = (start: string, minutes: number) =>
  Temporal.Instant.from(start).add({ minutes }).toString();

export function formatActivityTime(instant: string, zone: string) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: zone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(instant));
}

export function formatActivityRange(start: string, end: string, zone: string) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: zone,
    dateStyle: "medium",
    timeStyle: "short",
  }).formatRange(new Date(start), new Date(end));
}

export function formatActivityDuration(start: string, end: string) {
  const total = Math.round(
    Temporal.Instant.from(end)
      .since(Temporal.Instant.from(start))
      .total("minutes"),
  );
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return [hours && `${hours} hr`, (minutes || !hours) && `${minutes} min`]
    .filter(Boolean)
    .join(" ");
}

export const fullDateLabel = (date: string) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
export const dateLabel = (date: string) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
export const monthDay = (date: string) => {
  const parts = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).formatToParts(new Date(`${date}T12:00:00Z`));
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return { month: part("month"), day: part("day") };
};
export const timeLabel = (instant: string, zone: string) =>
  new Intl.DateTimeFormat(undefined, {
    timeZone: zone,
    timeStyle: "short",
  }).format(new Date(instant));
export const localDate = (instant: string, zone: string) =>
  Temporal.Instant.from(instant)
    .toZonedDateTimeISO(zone)
    .toPlainDate()
    .toString();
export const boundary = (date: string, zone: string) =>
  Temporal.PlainDate.from(date)
    .toZonedDateTime({ timeZone: zone, plainTime: "00:00" })
    .toInstant()
    .toString();
export const moveDate = (date: string, days: number) =>
  Temporal.PlainDate.from(date).add({ days }).toString();
