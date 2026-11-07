"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ApiError, useApi } from "@/lib/api";
import type { Activity } from "@/lib/itinerary";
import { activityKey, personalTotals } from "@/lib/activity-expenses";
import { expenseMoney as formatMoney } from "@/lib/money";
import { ActivityExpenses } from "@/components/features/expenses/activity-expenses";
import { PersonalPayments } from "@/components/features/expenses/personal-payments/personal-payments";
import {
  useFinance,
  type Context,
} from "@/components/features/expenses/use-finance";
import { TripError } from "@/components/shared/trip-states";

export function Expenses(props: Context & { active: boolean }) {
  const { trip, active } = props;
  const { ledger, currencies } = useFinance(props, active);
  const read = useApi();
  const activities = useQuery({
    queryKey: ["trip", trip.id, "activities", "expense-options"],
    enabled: active,
    retry: false,
    queryFn: async ({ signal }) => {
      const all: Activity[] = [];
      for (let offset = 0; ; offset += 100) {
        const page = await read<Activity[]>(
          `/api/v1/trips/${trip.id}/activities?limit=100&offset=${offset}`,
          { signal },
        );
        if (!page) throw new ApiError(500, "Unable to load activities.");
        all.push(...page);
        if (page.length < 100) break;
      }
      return all.sort(
        (a, b) => a.starts_at.localeCompare(b.starts_at) || a.id - b.id,
      );
    },
  });
  if (!active) return null;
  const data = ledger.data;
  const money = (amount: string | bigint, currency: string) =>
    formatMoney(
      String(amount),
      currencies.data?.find((c) => c.code === currency) ?? {
        code: currency,
        decimals: 2,
      },
    );
  const historical = [
    ...new Map(
      [...(data?.expenses ?? []), ...(data?.loans ?? [])]
        .filter((e) => !e.activity_id)
        .map((e) => [
          activityKey(e),
          e.activity_name
            ? `${e.activity_name} (removed)`
            : "Unassigned expenses",
        ]),
    ).entries(),
  ];
  if (
    (data?.settlements.some((s) => !s.payment_id && !s.loan_id) ||
      !!data?.reversed_settlements?.length) &&
    !historical.some(([key]) => key === "unassigned")
  )
    historical.push(["unassigned", "Unassigned expenses"]);
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold">Activity expenses</h2>
        <p className="text-muted-foreground">
          Choose an activity to see costs and payments.
        </p>
      </div>
      {(ledger.isPending || activities.isPending || currencies.isPending) && (
        <p role="status">Loading activity expenses…</p>
      )}
      {(ledger.error || activities.error || currencies.error) && (
        <TripError
          error={ledger.error ?? activities.error ?? currencies.error}
          retry={() => {
            void ledger.refetch();
            void activities.refetch();
            void currencies.refetch();
          }}
        />
      )}
      {data && activities.data && currencies.data && (
        <>
          <PersonalPayments
            {...props}
            ledger={data}
            currencies={currencies.data}
          />
          {!activities.data.length && (
            <p>
              No activities yet. Add an activity in the itinerary to start
              planning expenses.
            </p>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {activities.data.map((a) => {
              const costs = data.expenses.filter((e) => e.activity_id === a.id);
              const loans = data.loans.filter((l) => l.activity_id === a.id);
              const codes = [
                ...new Set([...costs, ...loans].map((e) => e.currency)),
              ];
              return (
                <Link
                  key={a.id}
                  href={`/trips/${trip.id}?activity=${a.id}`}
                  scroll={false}
                  className="rounded-2xl border bg-card p-5 focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <h3 className="font-semibold break-words">{a.title}</h3>
                  {!codes.length ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No expenses yet
                    </p>
                  ) : (
                    codes.map((code) => {
                      const total = costs
                        .filter((e) => e.currency === code)
                        .reduce((n, e) => n + BigInt(e.amount_minor), 0n);
                      const own = personalTotals(
                        data,
                        props.current?.user_id ?? 0,
                        code,
                        String(a.id),
                      );
                      return (
                        <div key={code} className="mt-3 space-y-1 text-sm">
                          <p>
                            Total {money(total, code)} · My share{" "}
                            {money(own.cost, code)}
                          </p>
                          <p className="text-muted-foreground">
                            {own.remaining > 0n
                              ? `Still to pay ${money(own.remaining, code)}`
                              : "My share paid"}
                            {own.owed > 0n
                              ? ` · Owed to me ${money(own.owed, code)}`
                              : ""}
                          </p>
                        </div>
                      );
                    })
                  )}
                  <p className="mt-4 text-sm font-medium text-primary">
                    View activity →
                  </p>
                </Link>
              );
            })}
          </div>
          {historical.map(([key, title]) => (
            <details key={key} className="rounded-2xl border p-5">
              <summary className="cursor-pointer font-medium">{title}</summary>
              <ActivityExpenses
                {...props}
                activityID={key}
                activityTitle={title}
                activities={activities.data}
              />
            </details>
          ))}
        </>
      )}
    </section>
  );
}
