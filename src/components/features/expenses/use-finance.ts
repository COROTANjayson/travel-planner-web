import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { useExpensesApi } from "@/lib/expenses";
import type { Participant } from "@/lib/memberships";
import type { Trip } from "@/lib/trips";

export type Context = {
  trip: Trip;
  participants?: Participant[];
  current?: Participant;
  onFailure: (error: Error) => void | Promise<void>;
};

export function useFinance({ trip, onFailure }: Context, active = true) {
  const api = useExpensesApi(trip.id, onFailure);
  const ledger = useQuery({
    queryKey: ["trip", trip.id, "ledger", "activity"],
    queryFn: ({ signal }) => api.ledger(signal),
    enabled: active,
    retry: false,
  });
  const currencies = useQuery({
    queryKey: ["expense-currencies"],
    queryFn: ({ signal }) => api.currencies(signal),
    enabled: active,
    retry: false,
  });
  useEffect(() => {
    if (
      ledger.error instanceof ApiError &&
      [403, 404].includes(ledger.error.status)
    )
      void onFailure(ledger.error);
  }, [ledger.error, onFailure]);
  return { api, ledger, currencies };
}
