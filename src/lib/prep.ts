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
  /** On edit, a different kind starts the task over: no assignee, completion or ticks. */
  kind?: PrepTaskKind;
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

/** Unfinished work that waits on `me`: their task, or an everyone task they haven't ticked. */
export const waitsOn = (task: PrepTask, me: number | undefined) =>
  me !== undefined &&
  !isTaskDone(task) &&
  (task.kind === "everyone"
    ? task.waiting_user_ids.includes(me)
    : task.assignee?.user_id === me);

const unclaimed = (task: PrepTask) =>
  task.kind === "one_person" && !task.assignee;

/** The All view's sections, by who acts next. */
export function prepSections(tasks: PrepTask[], me: number | undefined) {
  const open = tasks.filter((task) => !isTaskDone(task));
  return {
    forYou: open.filter((task) => waitsOn(task, me)),
    upForGrabs: open.filter(unclaimed),
    withOthers: open.filter((task) => !waitsOn(task, me) && !unclaimed(task)),
    done: tasks.filter(isTaskDone),
  };
}

/** Unfinished tasks by activity, earliest activity first, then Whole trip. */
export function prepByActivity(tasks: PrepTask[]) {
  const groups = new Map<
    number,
    { activity: PrepActivity; tasks: PrepTask[] }
  >();
  const wholeTrip: PrepTask[] = [];
  for (const task of tasks.filter((task) => !isTaskDone(task))) {
    if (!task.activity) wholeTrip.push(task);
    else
      (
        groups.get(task.activity.id) ??
        groups
          .set(task.activity.id, { activity: task.activity, tasks: [] })
          .get(task.activity.id)!
      ).tasks.push(task);
  }
  return {
    activities: [...groups.values()].sort(
      (a, b) =>
        a.activity.starts_at.localeCompare(b.activity.starts_at) ||
        a.activity.id - b.activity.id,
    ),
    wholeTrip,
  };
}

/** Sums minor-unit amounts per currency, in first-seen order. */
export function totalsByCurrency(
  items: { currency: string; amount_minor: string }[],
) {
  const totals = new Map<string, bigint>();
  for (const item of items)
    totals.set(
      item.currency,
      (totals.get(item.currency) ?? 0n) + BigInt(item.amount_minor),
    );
  return [...totals].map(([currency, minor]) => ({
    currency,
    amount_minor: minor.toString(),
  }));
}

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
  // Task edits move linked expenses to the task's activity and deleting a task
  // detaches them, so the ledger refreshes with the list.
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: prepKey(tripID) }),
      client.invalidateQueries({ queryKey: ["trip", tripID, "ledger"] }),
    ]);
  async function mutate<T>(
    path: string,
    method: "POST" | "PUT" | "DELETE",
    body?: object,
    successMessage?: string,
    key?: string,
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
              headers: {
                "Content-Type": "application/json",
                ...(key ? { "Idempotency-Key": key } : {}),
              },
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
    /** `key` stays the same for retries of one submission, so a retry can't add a second task. */
    create: (
      input: PrepTaskInput,
      key?: string,
      successMessage = "Task added.",
    ) =>
      mutate<PrepTask>(
        base,
        "POST",
        { ...input, title: input.title.trim() },
        successMessage,
        key,
      ),
    update: (
      id: number,
      details: PrepTaskDetails,
      successMessage = "Task updated.",
    ) =>
      mutate<PrepTask>(
        task(id),
        "PUT",
        { ...details, title: details.title.trim() },
        successMessage,
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
