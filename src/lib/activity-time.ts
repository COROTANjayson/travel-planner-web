import { Temporal } from "@js-temporal/polyfill";

export type Occurrence = "" | "earlier" | "later";
export interface TimeChoice { instant: string; offset: string; occurrence: Exclude<Occurrence, ""> }

// Native datetime inputs accept milliseconds; keep full precision in the draft.
export const dateTimeInputValue = (value: string) => value.replace(/(\.\d{3})\d+$/, "$1");

export function inspectLocalTime(value: string, zone: string): { choices: TimeChoice[]; error?: string } {
  if (!value) return { choices: [] };
  try {
    const local = Temporal.PlainDateTime.from(value);
    const earlier = local.toZonedDateTime(zone, { disambiguation: "earlier" });
    const later = local.toZonedDateTime(zone, { disambiguation: "later" });
    if (!earlier.toPlainDateTime().equals(local) || !later.toPlainDateTime().equals(local)) {
      return { choices: [], error: "This local time does not exist because the clocks change. Choose another time." };
    }
    const choices: TimeChoice[] = [{ instant: earlier.toInstant().toString(), offset: earlier.offset, occurrence: "earlier" }];
    if (earlier.epochNanoseconds !== later.epochNanoseconds) {
      choices.push({ instant: later.toInstant().toString(), offset: later.offset, occurrence: "later" });
    }
    return { choices };
  } catch {
    return { choices: [], error: "Enter a valid local date and time and an IANA time zone." };
  }
}

export function localToInstant(value: string, zone: string, occurrence: Occurrence = ""): string {
  if (!value) throw new Error("Start and end times are required.");
  const { choices, error } = inspectLocalTime(value, zone);
  if (error) throw new Error(error);
  if (choices.length === 1) return choices[0].instant;
  const selected = choices.find((choice) => choice.occurrence === occurrence);
  if (!selected) throw new Error("This local time occurs twice. Choose the earlier or later occurrence.");
  return selected.instant;
}

export function instantToLocal(instant: string, zone: string): { value: string; occurrence: Occurrence } {
  const exact = Temporal.Instant.from(instant);
  const value = exact.toZonedDateTimeISO(zone).toPlainDateTime().toString();
  const { choices } = inspectLocalTime(value, zone);
  return { value, occurrence: choices.length === 2
    ? choices.find((choice) => Temporal.Instant.compare(choice.instant, exact) === 0)!.occurrence : "" };
}

export function formatActivityTime(instant: string, zone: string) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: zone, dateStyle: "medium", timeStyle: "short",
  }).format(new Date(instant));
}
