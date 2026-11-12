"use client";

import { useState, type RefObject } from "react";
import { CategoryBadge } from "@/components/features/itinerary/category-badge";
import {
  filterButtonClass,
  filterCountClass,
  filterNavClass,
} from "@/components/features/trips/trip-filters";
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
import { cn } from "@/lib/utils";
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
      <div className="expense-mobile-filter [display:flex] [align-items:center] [justify-content:space-between] [gap:12px] [&_[data-slot='select-trigger']]:[min-height:44px] [&_[data-slot='select-trigger']]:[min-width:9rem] [&_[data-slot='select-trigger']]:[font-size:0.875rem] md:[&]:[display:none]">
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
        className={cn(
          filterNavClass,
          "w-fit max-w-full [scrollbar-width:none] max-md:hidden [&::-webkit-scrollbar]:hidden",
        )}
      >
        {filters.map((option) => (
          <Button
            key={option}
            type="button"
            className={cn(
              filterButtonClass,
              "min-h-10 flex-none gap-1.5 px-3.5 text-[0.8125rem] whitespace-nowrap",
            )}
            variant="ghost"
            aria-pressed={filter === option}
            ref={filter === option ? filterRef : undefined}
            onClick={() => setFilter(option)}
          >
            {option}
            <span className={cn(filterCountClass, "min-w-0 font-medium")}>
              {entries.filter((e) => matches(option, e, today)).length}
            </span>
          </Button>
        ))}
      </nav>
      {!rows.length ? (
        <p className="expense-empty [padding:2rem_1.25rem] [border:1px_dashed_var(--input)] [border-radius:1rem] [text-align:center] [text-wrap:balance] [font-size:0.875rem] [color:var(--muted-foreground)]">
          {entries.length
            ? "Nothing matches this filter."
            : "No expenses yet. Open an activity in the itinerary to add or settle expenses."}
        </p>
      ) : (
        <ol className="expense-ledger [&]:[display:grid] [&]:[overflow:hidden] [&]:[border:1px_solid_var(--border)] [&]:[border-radius:1rem] [&]:[background:var(--card)] [&_>_li_+_li]:[border-top:1px_solid_var(--border)]">
          {rows.map((e) => {
            const date = e.date ? monthDay(e.date) : null;
            return (
              <li
                key={e.key}
                className="expense-row relative [&_.activity-category]:[grid-area:icon] [&_.activity-category]:[width:2.5rem] [&_.activity-category]:[height:2.5rem] [&]:[display:grid] [&]:[grid-template-columns:auto_minmax(0,_1fr)] [&]:[grid-template-areas:'date_text'_'icon_text'_'money_money'] [&]:[gap:0.625rem_0.875rem] [&]:[padding:0.875rem_1rem] [&]:[overflow-wrap:anywhere] sm:[&]:[grid-template-columns:auto_auto_minmax(0,_1fr)_auto] sm:[&]:[grid-template-areas:'date_icon_text_money'] sm:[&]:[align-items:center] sm:[&]:[column-gap:1rem] sm:[&]:[padding:1rem_1.25rem] max-sm:[&]:[grid-template-columns:32px_minmax(0,_1fr)] max-sm:[&]:[grid-template-areas:'date_text'_'icon_money'] max-sm:[&]:[gap:8px] max-sm:[&]:[padding:12px] max-sm:[&_.activity-category]:[width:28px] max-sm:[&_.activity-category]:[height:28px] max-sm:[&_.activity-category]:[justify-self:center] max-sm:[&_.activity-category]:[align-self:center] max-sm:[&_.activity-category]:[border-radius:8px]"
              >
                {e.debt && onReceive && (
                  <button
                    type="button"
                    className="absolute inset-0 cursor-pointer rounded-sm hover:bg-primary/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                    aria-label={`Record money received: ${e.title}`}
                    aria-haspopup="dialog"
                    onClick={(event) => onReceive(e, event.currentTarget)}
                  />
                )}
                <span className="expense-row-date [grid-area:date] [width:2.5rem] [text-align:center] [font-size:0.8125rem] [line-height:1.25rem] [color:var(--muted-foreground)] [font-variant-numeric:tabular-nums] [&_time]:[display:flex] [&_time]:[flex-direction:column] [&_strong]:[font-size:1.375rem] [&_strong]:[line-height:1.75rem] [&_strong]:[font-weight:700] [&_strong]:[color:var(--foreground)] max-sm:[&]:[width:32px] max-sm:[&]:[font-size:0.75rem] max-sm:[&]:[line-height:1rem] max-sm:[&_strong]:[font-size:1.25rem] max-sm:[&_strong]:[line-height:1.5rem]">
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
                <span className="expense-row-text [grid-area:text] [display:grid] [gap:0.125rem] [min-width:0] max-sm:[&]:[align-content:start] max-sm:[&]:[gap:4px]">
                  <strong className="expense-row-title [font-weight:600] [line-height:1.4] max-sm:[&]:[font-size:0.9375rem] max-sm:[&]:[line-height:1.25rem]">
                    {e.title}
                  </strong>
                  <span className="expense-row-detail [font-size:0.8125rem] [line-height:1.5] [color:var(--muted-foreground)] max-sm:[&]:[font-size:0.8125rem] max-sm:[&]:[line-height:1.125rem]">
                    {e.detail}
                  </span>
                </span>
                <span className="expense-row-money [grid-area:money] [display:flex] [align-items:baseline] [justify-content:space-between] [gap:0.75rem] [font-variant-numeric:tabular-nums] sm:[&]:[flex-direction:column] sm:[&]:[align-items:flex-end] sm:[&]:[gap:0.125rem] sm:[&]:[max-width:14rem] sm:[&]:[text-align:right] max-sm:[&]:[align-self:center] max-sm:[&]:[gap:8px]">
                  <span
                    className="expense-row-status [font-size:0.8125rem] [font-weight:600] [color:var(--muted-foreground)] [&::first-letter]:[text-transform:uppercase] [&[data-tone='owe']]:[color:var(--destructive)] [&[data-tone='owed']]:[color:var(--primary)] max-sm:[&]:[font-size:0.75rem] max-sm:[&]:[line-height:1.125rem]"
                    data-tone={e.status}
                  >
                    {e.status_label}
                  </span>
                  <span className="expense-row-amount [display:flex] [flex-direction:column] [align-items:flex-end] [text-align:right] [&_strong]:[font-size:1.0625rem] [&_strong]:[line-height:1.5rem] [&_strong]:[font-weight:700] [&_strong]:[letter-spacing:-0.01em] [&_span]:[font-size:0.75rem] [&_span]:[line-height:1rem] [&_span]:[color:var(--muted-foreground)] max-sm:[&_strong]:[font-size:1rem] max-sm:[&_strong]:[line-height:1.375rem]">
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
