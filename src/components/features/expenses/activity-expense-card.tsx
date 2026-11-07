"use client";

import Link from "next/link";
import { personalTotals } from "@/lib/activity-expenses";
import type { ActivityLedger } from "@/lib/expenses";
import type { Activity } from "@/lib/itinerary";
import type { Participant } from "@/lib/memberships";
import type { Trip } from "@/lib/trips";

export function ActivityExpenseCard({
  a,
  trip,
  data,
  current,
  money,
}: {
  a: Activity;
  trip: Trip;
  data: ActivityLedger;
  current?: Participant;
  money: (amount: string | bigint, currency: string) => string;
}) {
  const costs = data.expenses.filter((e) => e.activity_id === a.id);
  const loans = data.loans.filter((l) => l.activity_id === a.id);
  const codes = [...new Set([...costs, ...loans].map((e) => e.currency))];
  return (
    <Link
      href={`/trips/${trip.id}?activity=${a.id}`}
      scroll={false}
      className="rounded-2xl border bg-card p-5 focus-visible:outline-2 focus-visible:outline-primary"
    >
      <h3 className="font-semibold break-words">{a.title}</h3>
      {!codes.length ? (
        <p className="mt-2 text-sm text-muted-foreground">No expenses yet</p>
      ) : (
        codes.map((code) => {
          const total = costs
            .filter((e) => e.currency === code)
            .reduce((n, e) => n + BigInt(e.amount_minor), 0n);
          const own = personalTotals(
            data,
            current?.user_id ?? 0,
            code,
            String(a.id),
          );
          return (
            <div key={code} className="mt-3 space-y-1 text-sm">
              <p>
                Total {money(total, code)} · My share {money(own.cost, code)}
              </p>
              <p className="text-muted-foreground">
                {own.remaining > 0n
                  ? `Still to pay ${money(own.remaining, code)}`
                  : "My share paid"}
                {own.owed > 0n ? ` · Owed to me ${money(own.owed, code)}` : ""}
              </p>
            </div>
          );
        })
      )}
      <p className="mt-4 text-sm font-medium text-primary">View activity →</p>
    </Link>
  );
}
