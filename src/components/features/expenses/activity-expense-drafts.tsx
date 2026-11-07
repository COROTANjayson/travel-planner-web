"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { ApiError, useApi } from "@/lib/api";
import {
  type ActivityLedger,
  type CostChange,
  type Currency,
  type Expense,
  type ExpenseInput,
  type ExpensePerson,
} from "@/lib/expenses";
import { equalShares, expenseMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { ExpenseCostEditor } from "@/components/features/expenses/drawers/cost-editor/expense-cost-editor";
import { TripError } from "@/components/shared/trip-states";

export function ActivityExpenseDrafts({
  tripID,
  activityID,
  title,
  zone,
  people,
  userID,
  changes,
  onChange,
  pending,
}: {
  tripID: number;
  activityID?: number;
  title: string;
  zone: string;
  people: ExpensePerson[];
  userID?: number;
  changes: CostChange[];
  onChange: (changes: CostChange[]) => void;
  pending: boolean;
}) {
  const read = useApi();
  const ledger = useQuery({
    queryKey: ["trip", tripID, "ledger", "activity"],
    queryFn: ({ signal }) =>
      read<ActivityLedger>(`/api/v1/trips/${tripID}/expense-ledger`, {
        signal,
      }),
    retry: false,
  });
  const currencies = useQuery({
    queryKey: ["expense-currencies"],
    queryFn: ({ signal }) =>
      read<Currency[]>("/api/v1/expense-currencies", { signal }),
    retry: false,
  });
  const trigger = useRef<HTMLElement | null>(null);
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<Expense | null | undefined>(undefined);
  const originals =
    ledger.data?.expenses.filter(
      (e) => e.activity_id === activityID && !!activityID,
    ) ?? [];
  const allPeople = [
    ...new Map(
      [...(ledger.data?.people ?? []), ...people].map((p) => [p.user_id, p]),
    ).values(),
  ];
  function record(input: CostChange): Expense {
    const old = originals.find((e) => e.id === input.id);
    return {
      ...old,
      ...input,
      id: input.id ?? -1,
      trip_id: tripID,
      created_by_user_id: old?.created_by_user_id ?? userID ?? 0,
      version: input.version ?? 0,
      created_at: old?.created_at ?? "",
      updated_at: old?.updated_at ?? "",
      people: allPeople,
      shares:
        input.split_mode === "equal"
          ? equalShares(
              input.amount_minor,
              input.shares.map((s) => s.user_id),
            )
          : input.shares.map((s) => ({
              user_id: s.user_id,
              amount_minor: s.amount_minor!,
            })),
    };
  }
  const costs = [
    ...originals.filter((e) => !changes.some((c) => c.id === e.id)),
    ...changes.map(record),
  ];
  const money = (amount: string, currency: string) =>
    expenseMoney(
      amount,
      currencies.data?.find((c) => c.code === currency) ?? {
        code: currency,
        decimals: 2,
      },
    );
  async function stage(input: ExpenseInput) {
    const id = editing?.id ?? Math.min(0, ...changes.map((c) => c.id ?? 0)) - 1;
    onChange([...changes.filter((c) => c.id !== id), { ...input, id }]);
    setEditing(undefined);
  }
  // With nothing added yet, this is only a pill in the form's Add more row.
  const compact = !costs.length && !ledger.error && !currencies.error;
  const startAdding = (event: { currentTarget: HTMLElement }) => {
    trigger.current = event.currentTarget;
    setEditing(null);
  };
  const adding = pending || !ledger.data || !currencies.data;
  return (
    <div
      className={
        compact
          ? undefined
          : "activity-finance activity-plan-expenses space-y-5"
      }
      data-finance-view={compact ? undefined : "overview"}
    >
      {compact ? (
        <Button
          type="button"
          variant="secondary"
          className="min-h-11 rounded-full"
          aria-label="Add expense"
          disabled={adding}
          onClick={startAdding}
        >
          <Plus aria-hidden="true" className="size-3.5" />
          Expense
        </Button>
      ) : (
        <div className="activity-section-heading">
          <h3>Expenses</h3>
        </div>
      )}
      {(ledger.isPending || currencies.isPending) && (
        <p role="status" className={compact ? "sr-only" : undefined}>
          Loading expenses…
        </p>
      )}
      {(ledger.error || currencies.error) && (
        <TripError
          error={ledger.error ?? currencies.error}
          retry={() => {
            void ledger.refetch();
            void currencies.refetch();
          }}
        />
      )}
      {[...new Set(costs.map((c) => c.currency))].map((currency) => (
        <div key={currency} className="activity-cost-total">
          <div>
            <p className="text-xs text-muted-foreground">Estimated total</p>
            <p className="text-xl font-semibold">
              {money(
                costs
                  .filter((c) => c.currency === currency)
                  .reduce((n, c) => n + BigInt(c.amount_minor), 0n)
                  .toString(),
                currency,
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Your share</p>
            <p className="text-xl font-semibold">
              {money(
                costs
                  .filter((c) => c.currency === currency)
                  .reduce(
                    (n, c) =>
                      n +
                      BigInt(
                        c.shares.find((s) => s.user_id === userID)
                          ?.amount_minor ?? "0",
                      ),
                    0n,
                  )
                  .toString(),
                currency,
              )}
            </p>
          </div>
        </div>
      ))}
      {!!costs.length && (
        <div className="activity-plan-costs">
          {costs.map((cost) => {
            const equal = cost.shares.every(
              (s) => s.amount_minor === cost.shares[0]?.amount_minor,
            );
            return (
              <div key={cost.id} className="activity-plan-cost">
                <div>
                  <Button
                    type="button"
                    variant="link"
                    onClick={(event) => {
                      trigger.current = event.currentTarget;
                      setEditing(cost);
                    }}
                  >
                    {cost.description}
                  </Button>
                  <span>
                    {equal && cost.shares[0]
                      ? `${money(cost.shares[0].amount_minor, cost.currency)} each`
                      : money(cost.amount_minor, cost.currency)}
                  </span>
                </div>
                <p>
                  {cost.shares.length} people ·{" "}
                  {money(cost.amount_minor, cost.currency)} total
                </p>
              </div>
            );
          })}
        </div>
      )}
      {!compact && (
        <div className="activity-finance-actions">
          <Button
            type="button"
            variant="link"
            className="px-0"
            disabled={adding}
            onClick={startAdding}
          >
            <Plus aria-hidden="true" className="size-3.5" />
            {costs.length ? "Add another expense" : "Add expense"}
          </Button>
        </div>
      )}
      {editing !== undefined && currencies.data && (
        <ExpenseCostEditor
          tripID={tripID}
          activity={{ id: activityID, title: title.trim() }}
          initial={editing ?? undefined}
          people={allPeople.filter(
            (p) =>
              people.some((m) => m.user_id === p.user_id) ||
              editing?.shares.some((s) => s.user_id === p.user_id),
          )}
          currencies={currencies.data}
          zone={zone}
          finalFocus={() => trigger.current}
          onSave={stage}
          key={`${editing?.id ?? "new"}-${revision}`}
          onReload={
            editing && editing.id > 0
              ? async () => {
                  const latest = await read<Expense>(
                    `/api/v1/trips/${tripID}/expenses/${editing.id}`,
                  );
                  if (!latest)
                    throw new ApiError(500, "Unable to reload the expense.");
                  onChange(changes.filter((c) => c.id !== editing.id));
                  setRevision((n) => n + 1);
                  setEditing(latest);
                }
              : undefined
          }
          onBack={() => setEditing(undefined)}
        />
      )}
    </div>
  );
}
