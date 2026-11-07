"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, useApi } from "@/lib/api";
import type { Activity } from "@/lib/itinerary";
import type { Participant } from "@/lib/memberships";
import { toast } from "sonner";

export type PrepTaskKind = "one_person" | "everyone";
export interface PrepAssignee {
  user_id: number;
  display_name: string;
  email: string | null;
}
export type PrepActivity = Pick<Activity, "id" | "title" | "starts_at">;
export interface PrepTask {
  id: number;
  trip_id: number;
  created_by_user_id: number;
  title: string;
  kind: PrepTaskKind;
  activity: PrepActivity | null;
  date: string | null;
  assignee: PrepAssignee | null;
  completed_at: string | null;
  ready_user_ids: number[];
  waiting_user_ids: number[];
  created_at: string;
  updated_at: string;
}
export interface PrepTaskDetails {
  title: string;
  activity_id: number | null;
  date: string | null;
}
export interface PrepTaskInput extends PrepTaskDetails {
  kind: PrepTaskKind;
  assignee_user_id: number | null;
}

export const prepKey = (tripID: number) => ["trip", tripID, "prep"];

/** Viewers can read Prep, but are not counted and cannot take tasks. */
export const takesPart = (person?: Pick<Participant, "role">) =>
  !!person && person.role !== "viewer";

export const isTaskDone = (task: PrepTask) =>
  task.kind === "everyone"
    ? task.waiting_user_ids.length === 0 && task.ready_user_ids.length > 0
    : task.completed_at !== null;

export function prepTitleError(title: string) {
  const trimmed = title.trim();
  if (!trimmed) return "Add what needs doing.";
  return new TextEncoder().encode(trimmed).length > 200
    ? "Use a shorter title (up to 200 bytes)."
    : null;
}

export function usePrepApi(
  tripID: number,
  onFailure: (error: Error) => void | Promise<void>,
) {
  const api = useApi();
  const client = useQueryClient();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const base = `/api/v1/trips/${tripID}/prep-tasks`;
  const refresh = () => client.invalidateQueries({ queryKey: prepKey(tripID) });
  async function mutate<T>(
    path: string,
    method: "POST" | "PUT" | "DELETE",
    body?: object,
    successMessage?: string,
  ): Promise<T | true | undefined> {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await api<T>(path, {
        method,
        ...(body
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }
          : {}),
      });
      await refresh();
      if (successMessage) toast.success(successMessage);
      return result ?? true;
    } catch (cause) {
      // A task that moved on is not a trip-level failure: only a role change
      // goes to onFailure, because it replaces or blocks the whole trip page.
      const stale =
        cause instanceof ApiError &&
        (cause.status === 404 || cause.status === 409);
      const failure = stale
        ? new ApiError(
            cause.status,
            "This task changed. The list has been refreshed.",
          )
        : cause instanceof ApiError
          ? cause
          : new Error("Something went wrong. Please try again.");
      setError(failure);
      if (stale) await refresh();
      else if (failure instanceof ApiError && failure.status === 403)
        await onFailure(failure);
      throw failure;
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  const task = (id: number, action = "") => `${base}/${id}${action}`;
  return {
    pending,
    error,
    reset: () => setError(null),
    list: async (signal?: AbortSignal) => {
      const tasks = await api<PrepTask[]>(base, { signal });
      if (tasks === undefined)
        throw new ApiError(500, "Unable to load prep tasks. Please try again.");
      return tasks;
    },
    create: (input: PrepTaskInput) =>
      mutate<PrepTask>(
        base,
        "POST",
        { ...input, title: input.title.trim() },
        "Task added.",
      ),
    update: (id: number, details: PrepTaskDetails) =>
      mutate<PrepTask>(
        task(id),
        "PUT",
        { ...details, title: details.title.trim() },
        "Task updated.",
      ),
    remove: (id: number) => mutate(task(id), "DELETE"),
    assign: (id: number, userID: number | null) =>
      mutate(
        task(id, "/assignee"),
        "PUT",
        { user_id: userID },
        "Task assigned.",
      ),
    claim: (id: number) => mutate(task(id, "/claim"), "PUT"),
    drop: (id: number) => mutate(task(id, "/claim"), "DELETE"),
    complete: (id: number) => mutate(task(id, "/completion"), "PUT"),
    reopen: (id: number) => mutate(task(id, "/completion"), "DELETE"),
  };
}
