"use client";

import { Temporal } from "@js-temporal/polyfill";
import { ApiError, useApi } from "@/lib/api";

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
  if (!input.name.trim() || !Number.isSafeInteger(input.destination_place_id) || input.destination_place_id < 1) return "Name and destination are required.";
  if (!!input.starts_at !== !!input.ends_at) return "Enter both exact times or turn off exact times.";
  try {
    if (input.start_date || input.end_date || !input.starts_at) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.start_date ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(input.end_date ?? "")) return "Choose both trip dates.";
      if (Temporal.PlainDate.compare(input.end_date!, input.start_date!) < 0) return "End date must be on or after start date.";
    }
    if (input.starts_at && input.ends_at && Temporal.Instant.compare(input.ends_at, input.starts_at) <= 0) return "Trip end must be after trip start.";
  } catch { return "Enter valid trip dates and times."; }
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

  function save(method: "POST" | "PUT", path: string, input: TripInput) {
    return read<Trip>(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tripInput(input)),
    });
  }

  return {
    list: (limit: number, offset: number, signal?: AbortSignal) =>
      read<Trip[]>(`/api/v1/trips?limit=${limit}&offset=${offset}`, { signal }),
    get: (id: number, signal?: AbortSignal) =>
      read<Trip>(`/api/v1/trips/${id}`, { signal }),
    create: (input: TripInput) => save("POST", "/api/v1/trips", input),
    update: (id: number, input: TripInput) =>
      save("PUT", `/api/v1/trips/${id}`, input),
    remove: (id: number) => api<void>(`/api/v1/trips/${id}`, { method: "DELETE" }),
  };
}
