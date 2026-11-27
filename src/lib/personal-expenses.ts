"use client";

import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, useApi } from "@/lib/api";

/** Private spending already paid by its creator; never part of the shared ledger. */
export interface PersonalExpenseInput {
  activity_id?: number;
  description: string;
  currency: string;
  amount_minor: string;
  incurred_on: string;
  version?: number;
}
export interface PersonalExpense extends Omit<PersonalExpenseInput, "version"> {
  id: number;
  trip_id: number;
  created_by_user_id: number;
  /** The activity's last title; kept after the link is gone. */
  activity_name?: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export const personalExpensesKey = (tripID: number) => [
  "trip",
  tripID,
  "personal-expenses",
];

export const personalExpenseInput = (
  input: PersonalExpenseInput,
): PersonalExpenseInput => ({
  ...(input.activity_id ? { activity_id: input.activity_id } : {}),
  description: input.description.trim(),
  currency: input.currency,
  amount_minor: input.amount_minor,
  incurred_on: input.incurred_on,
  ...(input.version === undefined ? {} : { version: input.version }),
});

export function usePersonalExpensesApi(
  tripID: number,
  onFailure: (error: Error) => void | Promise<void>,
) {
  const api = useApi();
  const client = useQueryClient();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const base = `/api/v1/trips/${tripID}/personal-expenses`;
  const refresh = useCallback(
    () => client.invalidateQueries({ queryKey: personalExpensesKey(tripID) }),
    [client, tripID],
  );
  async function list(signal?: AbortSignal) {
    const all: PersonalExpense[] = [];
    for (let offset = 0; ; offset += 100) {
      const page = await api<PersonalExpense[]>(
        `${base}?limit=100&offset=${offset}`,
        { signal },
      );
      if (!page)
        throw new ApiError(500, "Unable to load your personal expenses.");
      all.push(...page);
      if (page.length < 100) return all;
    }
  }
  async function get(id: number) {
    const record = await api<PersonalExpense>(`${base}/${id}`);
    if (!record)
      throw new ApiError(500, "Unable to load this expense. Please retry.");
    return record;
  }
  async function mutate(
    method: "POST" | "PUT" | "DELETE",
    input?: PersonalExpenseInput,
    record?: PersonalExpense,
    key?: string,
  ) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const data = await api<PersonalExpense>(
        `${base}${record ? `/${record.id}` : ""}${method === "DELETE" ? `?version=${record!.version}` : ""}`,
        {
          method,
          ...(input
            ? {
                headers: {
                  "Content-Type": "application/json",
                  ...(key ? { "Idempotency-Key": key } : {}),
                },
                body: JSON.stringify(personalExpenseInput(input)),
              }
            : {}),
        },
      );
      if (method !== "DELETE" && data === undefined)
        throw new ApiError(
          500,
          "Saving may have completed. Retry this submission or refresh before creating another expense.",
        );
      await refresh();
      toast.success(
        method === "DELETE"
          ? "Personal expense deleted."
          : "Personal expense saved.",
      );
      return data ?? true;
    } catch (cause) {
      const failure =
        cause instanceof ApiError
          ? cause
          : new ApiError(
              500,
              method === "DELETE"
                ? "Deleting may have completed. Refresh before trying again."
                : "Saving may have completed. Retry this submission or refresh before creating another expense.",
            );
      setError(failure);
      // A missing record is not a missing trip: refetching the list tells them
      // apart, and only the list's own 404 reports lost access.
      if ([400, 403, 404, 409].includes(failure.status)) await refresh();
      if (failure.status === 403) await onFailure(failure);
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
    list,
    get,
    save: (
      input: PersonalExpenseInput,
      record?: PersonalExpense,
      key?: string,
    ) =>
      mutate(
        record ? "PUT" : "POST",
        record ? { ...input, version: record.version } : input,
        record,
        key,
      ),
    remove: (record: PersonalExpense) => mutate("DELETE", undefined, record),
  };
}
