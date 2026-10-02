"use client";

import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, useApi } from "@/lib/api";
import { type Place } from "@/lib/places";

export interface ActivityInput {
  title: string; starts_at: string; ends_at: string; time_zone: string; notes: string; place_id: number | null;
}
export interface Activity extends ActivityInput {
  id: number; trip_id: number; created_by_user_id: number; created_at: string; updated_at: string;
  place: Place | null;
}
export interface ActivityConflict {
  activity_ids: [number, number]; overlap_starts_at: string; overlap_ends_at: string;
}
export const activityPageSize = 10;
export function activityInput(input: ActivityInput): ActivityInput {
  return { title: input.title.trim(), starts_at: input.starts_at, ends_at: input.ends_at,
    time_zone: input.time_zone.trim(), notes: input.notes, place_id: input.place_id ?? null };
}

export function useItineraryApi(tripID: number, onFailure: (error: Error) => void | Promise<void>) {
  const api = useApi();
  const client = useQueryClient();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const base = `/api/v1/trips/${tripID}/activities`;
  async function read<T>(path: string, signal?: AbortSignal): Promise<T> {
    const result = await api<T>(path, { signal });
    if (result === undefined) throw new ApiError(500, "Unable to load activities. Please try again.");
    return result;
  }
  const refresh = useCallback(async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["trip", tripID, "activities"] }),
      client.invalidateQueries({ queryKey: ["trip", tripID, "conflicts"] }),
    ]);
  }, [client, tripID]);
  async function mutate(method: "POST" | "PUT" | "DELETE", id?: number, input?: ActivityInput) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await api<Activity>(id === undefined ? base : `${base}/${id}`, {
        method, ...(input ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(activityInput(input)) } : {}),
      });
      if (method !== "DELETE" && result === undefined) throw new ApiError(500, "Unable to save the activity. Please try again.");
      const activityID = result?.id ?? id;
      const key = ["trip", tripID, "activity", activityID];
      await client.cancelQueries({ queryKey: key, exact: true });
      if (method === "DELETE") client.removeQueries({ queryKey: key, exact: true });
      else client.setQueryData(key, result);
      await refresh();
      return result ?? true;
    } catch (cause) {
      const failure = cause instanceof ApiError && cause.status === 404
        ? new ApiError(404, "This activity is unavailable. The schedule has been refreshed.")
        : cause instanceof ApiError ? cause : new Error("Something went wrong. Please try again.");
      setError(failure);
      if (failure instanceof ApiError && failure.status === 404) {
        if (id !== undefined) {
          await client.cancelQueries({ queryKey: ["trip", tripID, "activity", id], exact: true });
          client.removeQueries({ queryKey: ["trip", tripID, "activity", id], exact: true });
        }
        await refresh();
      } else if (failure instanceof ApiError && failure.status === 403) {
        await onFailure(failure);
      }
      throw failure;
    } finally { busy.current = false; setPending(false); }
  }
  return {
    pending, error, reset: () => setError(null), refresh,
    list: (offset: number, signal?: AbortSignal) => read<Activity[]>(`${base}?limit=${activityPageSize}&offset=${offset}`, signal),
    get: (id: number, signal?: AbortSignal) => read<Activity>(`${base}/${id}`, signal),
    conflicts: (offset: number, signal?: AbortSignal) => read<ActivityConflict[]>(`${base}/conflicts?limit=${activityPageSize}&offset=${offset}`, signal),
    save: (input: ActivityInput, id?: number) => mutate(id === undefined ? "POST" : "PUT", id, input),
    remove: (id: number) => mutate("DELETE", id),
  };
}
