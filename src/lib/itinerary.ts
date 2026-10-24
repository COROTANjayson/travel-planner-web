"use client";

import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, useApi } from "@/lib/api";
import { type Place } from "@/lib/places";
import { toast } from "sonner";

export const activityCategories = [
  "Rest",
  "Eating",
  "Travel",
  "Activity",
] as const;
export interface ChecklistItem {
  text: string;
  done: boolean;
}
export interface ActivityInput {
  title: string;
  starts_at: string;
  ends_at: string;
  time_zone: string;
  notes: string;
  place_id: number | null;
  category: string;
  checklist: ChecklistItem[];
}
export interface Activity extends ActivityInput {
  id: number;
  trip_id: number;
  created_by_user_id: number;
  created_at: string;
  updated_at: string;
  place: Place | null;
}
export interface ActivityConflict {
  activity_ids: [number, number];
  overlap_starts_at: string;
  overlap_ends_at: string;
}
export const activityPageSize = 10;
export function activityInput(input: ActivityInput): ActivityInput {
  return {
    title: input.title.trim(),
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    time_zone: input.time_zone.trim(),
    notes: input.notes,
    place_id: input.place_id ?? null,
    category: input.category.trim(),
    checklist: input.checklist.map((item) => ({
      text: item.text.trim(),
      done: item.done,
    })),
  };
}

export function useItineraryApi(
  tripID: number,
  onFailure: (error: Error) => void | Promise<void>,
) {
  const api = useApi();
  const client = useQueryClient();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const base = `/api/v1/trips/${tripID}/activities`;
  async function read<T>(path: string, signal?: AbortSignal): Promise<T> {
    const result = await api<T>(path, { signal });
    if (result === undefined)
      throw new ApiError(500, "Unable to load activities. Please try again.");
    return result;
  }
  const refresh = useCallback(async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["trip", tripID, "activities"] }),
      client.invalidateQueries({ queryKey: ["trip", tripID, "conflicts"] }),
    ]);
  }, [client, tripID]);
  async function mutate(
    method: "POST" | "PUT" | "DELETE",
    id?: number,
    input?: ActivityInput,
  ) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await api<Activity>(
        id === undefined ? base : `${base}/${id}`,
        {
          method,
          ...(input
            ? {
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(activityInput(input)),
              }
            : {}),
        },
      );
      if (method !== "DELETE" && result === undefined)
        throw new ApiError(
          500,
          "Unable to save the activity. Please try again.",
        );
      const activityID = result?.id ?? id;
      const key = ["trip", tripID, "activity", activityID];
      await client.cancelQueries({ queryKey: key, exact: true });
      if (method === "DELETE")
        client.removeQueries({ queryKey: key, exact: true });
      else client.setQueryData(key, result);
      await refresh();
      if (method !== "DELETE")
        toast.success(
          method === "POST" ? "Activity created." : "Activity updated.",
        );
      return result ?? true;
    } catch (cause) {
      const failure =
        cause instanceof ApiError && cause.status === 404
          ? new ApiError(
              404,
              "This activity is unavailable. The schedule has been refreshed.",
            )
          : cause instanceof ApiError
            ? cause
            : new Error("Something went wrong. Please try again.");
      setError(failure);
      if (failure instanceof ApiError && failure.status === 404) {
        if (id !== undefined) {
          await client.cancelQueries({
            queryKey: ["trip", tripID, "activity", id],
            exact: true,
          });
          client.removeQueries({
            queryKey: ["trip", tripID, "activity", id],
            exact: true,
          });
        }
        await refresh();
      } else if (failure instanceof ApiError && failure.status === 403) {
        await onFailure(failure);
      }
      throw failure;
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return {
    pending,
    error,
    reset: () => setError(null),
    refresh,
    list: (offset: number, signal?: AbortSignal) =>
      read<Activity[]>(
        `${base}?limit=${activityPageSize}&offset=${offset}`,
        signal,
      ),
    listRange: async (from: string, before: string, signal?: AbortSignal) => {
      const items: Activity[] = [];
      const size = 100;
      for (let offset = 0; ; offset += size) {
        const page = await read<Activity[]>(
          `${base}?limit=${size}&offset=${offset}&start_from=${encodeURIComponent(from)}&start_before=${encodeURIComponent(before)}`,
          signal,
        );
        items.push(...page);
        if (page.length < size) return items;
      }
    },
    get: (id: number, signal?: AbortSignal) =>
      read<Activity>(`${base}/${id}`, signal),
    conflicts: async (signal?: AbortSignal) => {
      // shortcut: read all conflicts before day filtering; add server date filtering if large trips make this slow.
      const all: ActivityConflict[] = [];
      for (let offset = 0; ; offset += activityPageSize) {
        const page = await read<ActivityConflict[]>(
          `${base}/conflicts?limit=${activityPageSize}&offset=${offset}`,
          signal,
        );
        all.push(...page);
        if (page.length < activityPageSize) return all;
      }
    },
    save: (input: ActivityInput, id?: number) =>
      mutate(id === undefined ? "POST" : "PUT", id, input),
    remove: (id: number) => mutate("DELETE", id),
  };
}
