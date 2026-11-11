"use client";

import { useState, type RefObject } from "react";
import { CategoryBadge } from "@/components/features/itinerary/category-badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { monthDay } from "@/lib/activity-time";
import {
  expenseName,
  type ActivityLedger,
  type Currency,
  type ExpensePerson,
} from "@/lib/expenses";
import type { Activity } from "@/lib/itinerary";
import { moneyIn } from "@/lib/money";
import { categoryOf, myEntries, type MyEntry } from "@/lib/trip-expenses";

const filters = [
  "All",
  "Upcoming",
  "You owe",
  "Owed to you",
  "Settled",
] as const;
type Filter = (typeof filters)[number];

const matches = (filter: Filter, e: MyEntry, today: string) =>
  filter === "All" ||
  (filter === "Upcoming" && e.date > today) ||
  (filter === "You owe" && e.status === "owe") ||
  (filter === "Owed to you" && e.status === "owed") ||
  (filter === "Settled" && e.status === "settled");

export function TripExpenseList({
  ledger,
  activities,
  people,
  me,
  currencies,
  today,
  onReceive,
  filterRef,
  mobileFilterRef,
}: {
  ledger: ActivityLedger;
  activities: Activity[];
  people: ExpensePerson[];
  me: number;
  currencies: Currency[];
  today: string;
  onReceive?: (entry: MyEntry, trigger: HTMLButtonElement) => void;
  filterRef?: RefObject<HTMLButtonElement | null>;
  mobileFilterRef?: RefObject<HTMLButtonElement | null>;
}) {
  const [filter, setFilter] = useState<Filter>("All");
  const money = moneyIn(currencies);
  const name = (id: number) =>
    expenseName(people.find((p) => p.user_id === id));
  const entries = myEntries(ledger, activities, me, name);
  const rows = entries.filter((e) => matches(filter, e, today));
  return (
    <section aria-label="Expense list" className="space-y-3 md:space-y-4">
      <div className="expense-mobile-filter">
        <h3 className="text-base font-semibold">
          Expenses{" "}
          <span className="ml-1 text-sm font-normal text-muted-foreground">
            {rows.length}
          </span>
        </h3>
        <Select<Filter>
          value={filter}
          onValueChange={(value) => {
            if (value !== null) setFilter(value);
          }}
        >
          <SelectTrigger ref={mobileFilterRef} aria-label="Filter expenses">
            <SelectValue>{filter}</SelectValue>
          </SelectTrigger>
          <SelectContent
            align="end"
            alignItemWithTrigger={false}
            className="min-w-52"
          >
            {filters.map((option) => (
              <SelectItem
                key={option}
                value={option}
                className="min-h-11 px-3 pr-8"
              >
                <span className="flex-1">{option}</span>
                <span className="text-muted-foreground tabular-nums">
                  {entries.filter((e) => matches(option, e, today)).length}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <nav
        aria-label="Filter expenses"
        className="trip-filters expense-filters"
      >
        {filters.map((option) => (
          <Button
            key={option}
            type="button"
            className="trip-filter"
            variant="ghost"
            aria-pressed={filter === option}
            ref={filter === option ? filterRef : undefined}
            onClick={() => setFilter(option)}
          >
            {option}
            <span className="filter-count">
              {entries.filter((e) => matches(option, e, today)).length}
            </span>
          </Button>
        ))}
      </nav>
      {!rows.length ? (
        <p className="expense-empty">
          {entries.length
            ? "Nothing matches this filter."
            : "No expenses yet. Open an activity in the itinerary to add or settle expenses."}
        </p>
      ) : (
        <ol className="expense-ledger">
          {rows.map((e) => {
            const date = e.date ? monthDay(e.date) : null;
            return (
              <li key={e.key} className="expense-row relative">
                {e.debt && onReceive && (
                  <button
                    type="button"
                    className="absolute inset-0 cursor-pointer rounded-sm hover:bg-primary/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                    aria-label={`Record money received: ${e.title}`}
                    aria-haspopup="dialog"
                    onClick={(event) => onReceive(e, event.currentTarget)}
                  />
                )}
                <span className="expense-row-date">
                  {date ? (
                    <time dateTime={e.date} aria-label={e.date}>
                      <span>{date.month}</span>
                      <strong>{date.day}</strong>
                    </time>
                  ) : (
                    <span>No date</span>
                  )}
                </span>
                <CategoryBadge category={categoryOf(e, activities)} iconOnly />
                <span className="expense-row-text">
                  <strong className="expense-row-title">{e.title}</strong>
                  <span className="expense-row-detail">{e.detail}</span>
                </span>
                <span className="expense-row-money">
                  <span className="expense-row-status" data-tone={e.status}>
                    {e.status_label}
                  </span>
                  <span className="expense-row-amount">
                    <strong>
                      {money(e.status_amount ?? e.amount_minor, e.currency)}
                    </strong>
                    {e.total_minor !== undefined &&
                      e.total_label &&
                      BigInt(e.total_minor) !==
                        BigInt(e.status_amount ?? e.amount_minor) && (
                        <span>
                          {e.total_label}: {money(e.total_minor, e.currency)}
                        </span>
                      )}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
