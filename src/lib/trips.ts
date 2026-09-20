"use client";

import { ApiError, useApi } from "@/lib/api";

export interface TripInput {
  name: string;
  destination: string;
  start_date: string;
  end_date: string;
  time_zone: string;
}

export interface Trip extends TripInput {
  id: number;
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
    destination: input.destination.trim(),
    start_date: input.start_date,
    end_date: input.end_date,
    time_zone: input.time_zone.trim(),
  };
}

export function validateTrip(input: TripInput): string | undefined {
  if (Object.values(input).some((value) => !value.trim())) {
    return "All fields are required.";
  }
  if (input.end_date < input.start_date) {
    return "End date must be on or after the start date.";
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

