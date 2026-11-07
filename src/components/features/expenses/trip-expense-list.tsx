"use client";

import { useState } from "react";
import { CategoryBadge } from "@/components/features/itinerary/category-badge";
import { Button } from "@/components/ui/button";
import { dateLabel } from "@/lib/activity-time";
import {
  expenseName,
  type ActivityLedger,
  type Currency,
  type ExpensePerson,
} from "@/lib/expenses";
import type { Activity } from "@/lib/itinerary";
import { moneyIn } from "@/lib/money";
import { categoryOf, myEntries } from "@/lib/trip-expenses";

const filters = [
  "All",
  "Upcoming",
  "You owe",
  "Owed to you",
  "Settled",
] as const;

export function TripExpenseList({
  ledger,
  activities,
  people,
  me,
  currencies,
  today,
}: {
  ledger: ActivityLedger;
  activities: Activity[];
  people: ExpensePerson[];
  me: number;
  currencies: Currency[];
  today: string;
}) {
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const money = moneyIn(currencies);
  const name = (id: number) =>
    expenseName(people.find((p) => p.user_id === id));
  const entries = myEntries(ledger, activities, me, name);
  const rows = entries.filter(
    (e) =>
      filter === "All" ||
      (filter === "Upcoming" && e.date > today) ||
      (filter === "You owe" && e.status === "owe") ||
      (filter === "Owed to you" && e.status === "owed") ||
      (filter === "Settled" && e.status === "settled"),
  );
  return (
    <section aria-labelledby="trip-expense-list-heading" className="space-y-4">
      <h3 id="trip-expense-list-heading" className="text-lg font-semibold">
        Expenses
      </h3>
      <nav aria-label="Filter expenses" className="trip-filters">
        {filters.map((option) => (
          <Button
            key={option}
            type="button"
            className="trip-filter"
            variant="ghost"
            aria-pressed={filter === option}
            onClick={() => setFilter(option)}
          >
            {option}
          </Button>
        ))}
      </nav>
      {!rows.length ? (
        <p className="text-sm text-muted-foreground">
          {entries.length ? "Nothing matches this filter." : "No expenses yet."}
        </p>
      ) : (
        <ul className="divide-y">
          {rows.map((e) => {
            const tone =
              e.status === "owe"
                ? "text-destructive"
                : e.status === "owed"
                  ? "text-primary"
                  : "text-muted-foreground";
            return (
              <li
                key={e.key}
                className="flex min-h-11 items-start justify-between gap-4 py-4 [overflow-wrap:anywhere]"
              >
                <span className="min-w-0 space-y-1">
                  <CategoryBadge category={categoryOf(e, activities)} />
                  <strong className="block font-medium break-words">
                    {e.title}
                  </strong>
                  <span className="block text-sm text-muted-foreground">
                    {e.date ? `${dateLabel(e.date)} · ` : ""}
                    {e.detail}
                  </span>
                </span>
                <span className="max-w-1/2 shrink-0 text-right tabular-nums">
                  <strong className="block font-medium">
                    {money(e.amount_minor, e.currency)}
                  </strong>
                  <span className={`block text-sm ${tone}`}>
                    {e.status_label}
                    {e.status_amount
                      ? ` ${money(e.status_amount, e.currency)}`
                      : ""}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
