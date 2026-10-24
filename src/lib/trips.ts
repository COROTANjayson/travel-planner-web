"use client";

import { Temporal } from "@js-temporal/polyfill";
import { ApiError, useApi } from "@/lib/api";
import { toast } from "sonner";

export interface TripInput {
  name: string;
  destination_place_id: number;
  start_date?: string;
  end_date?: string;
  starts_at?: string | null;
  ends_at?: string | null;
}

export interface Trip {
  id: number;
  name: string;
  destination_place_id: number | null;
  starts_at: string | null;
  ends_at: string | null;
  destination: string;
  start_date: string;
  end_date: string;
  time_zone: string;
  created_at: string;
  updated_at: string;
}

export const tripPageSize = 10;

export function tripDayCount(start: string, end: string) {
  return (
    Temporal.PlainDate.from(end).since(Temporal.PlainDate.from(start)).days + 1
  );
}

export function formatTripDates(start: string, end: string, locale?: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).formatRange(new Date(`${start}T12:00:00Z`), new Date(`${end}T12:00:00Z`));
}

export type TripStatus = "Ongoing" | "Upcoming" | "Past";

export function tripStatus(
  start: string,
  end: string,
  zone: string,
): TripStatus {
  const today = Temporal.Now.zonedDateTimeISO(zone).toPlainDate().toString();
  return today < start ? "Upcoming" : today > end ? "Past" : "Ongoing";
}

const statusOrder: Record<TripStatus, number> = {
  Ongoing: 0,
  Upcoming: 1,
  Past: 2,
};

export function orderTrips(items: Trip[]) {
  return [...items].sort((a, b) => {
    const aStatus = tripStatus(a.start_date, a.end_date, a.time_zone);
    const bStatus = tripStatus(b.start_date, b.end_date, b.time_zone);
    const group = statusOrder[aStatus] - statusOrder[bStatus];
    if (group) return group;
    const dateOrder =
      aStatus === "Past"
        ? b.end_date.localeCompare(a.end_date)
        : aStatus === "Upcoming"
          ? a.start_date.localeCompare(b.start_date)
          : a.end_date.localeCompare(b.end_date);
    return dateOrder || b.id - a.id;
  });
}

export function validTripID(value: string): number | null {
  if (!/^[0-9]+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function tripInput(input: TripInput): TripInput {
  return {
    name: input.name.trim(),
    destination_place_id: input.destination_place_id,
    start_date: input.start_date,
    end_date: input.end_date,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
  };
}

export function validateTrip(input: TripInput): string | undefined {
  if (
    !input.name.trim() ||
    !Number.isSafeInteger(input.destination_place_id) ||
    input.destination_place_id < 1
  )
    return "Name and destination are required.";
  if (!!input.starts_at !== !!input.ends_at)
    return "Enter both exact times or turn off exact times.";
  try {
    if (input.start_date || input.end_date || !input.starts_at) {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(input.start_date ?? "") ||
        !/^\d{4}-\d{2}-\d{2}$/.test(input.end_date ?? "")
      )
        return "Choose both trip dates.";
      if (Temporal.PlainDate.compare(input.end_date!, input.start_date!) < 0)
        return "End date must be on or after start date.";
    }
    if (
      input.starts_at &&
      input.ends_at &&
      Temporal.Instant.compare(input.ends_at, input.starts_at) <= 0
    )
      return "Trip end must be after trip start.";
  } catch {
    return "Enter valid trip dates and times.";
  }
}

export function useTripsApi() {
  const api = useApi();

  async function read<T>(path: string, init?: RequestInit): Promise<T> {
    const result = await api<T>(path, init);
    if (result === undefined) {
      throw new ApiError(500, "Something went wrong. Please try again.");
    }
    return result;
  }

  async function save(method: "POST" | "PUT", path: string, input: TripInput) {
    const trip = await read<Trip>(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tripInput(input)),
    });
    toast.success(method === "POST" ? "Trip created." : "Trip updated.");
    return trip;
  }

  return {
    list: (limit: number, offset: number, signal?: AbortSignal) =>
      read<Trip[]>(`/api/v1/trips?limit=${limit}&offset=${offset}`, { signal }),
    get: (id: number, signal?: AbortSignal) =>
      read<Trip>(`/api/v1/trips/${id}`, { signal }),
    create: (input: TripInput) => save("POST", "/api/v1/trips", input),
    update: (id: number, input: TripInput) =>
      save("PUT", `/api/v1/trips/${id}`, input),
    remove: (id: number) =>
      api<void>(`/api/v1/trips/${id}`, { method: "DELETE" }),
  };
}
