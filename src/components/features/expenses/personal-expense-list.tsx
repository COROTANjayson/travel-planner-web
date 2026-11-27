"use client";

import { CaretRightIcon } from "@phosphor-icons/react";
import { CategoryBadge } from "@/components/features/itinerary/category-badge";
import {
  activityPlace,
  expenseListClass,
  RowDate,
  rowButtonClass,
} from "@/components/features/expenses/expense-list-parts";
import { monthDay } from "@/lib/activity-time";
import type { PersonalRow } from "@/lib/expense-views";
import type { Activity } from "@/lib/itinerary";
import { categoryOf } from "@/lib/expense-views";

type Money = (amount: string | bigint, currency: string) => string;

export const loanStatus = (left: bigint, currency: string, money: Money) =>
  left > 0n
    ? `${money(left, currency)} left`
    : left < 0n
      ? "Credit for review"
      : "Paid back";

export function PersonalExpenseList({
  rows,
  activities,
  name,
  money,
  onOpen,
}: {
  rows: PersonalRow[];
  activities: Activity[];
  name: (id: number) => string;
  money: Money;
  onOpen: (row: PersonalRow) => void;
}) {
  return (
    <ol className={expenseListClass} aria-label="Personal expenses">
      {rows.map((row) => {
        const { record } = row;
        const { month, day } = monthDay(row.date);
        const place = activityPlace(record, activities);
        const loan = row.kind === "loan";
        const open = loan && row.left !== 0n;
        return (
          <li
            key={`${row.kind}-${record.id}`}
            className="relative grid grid-cols-[40px_minmax(0,1fr)_fit-content(45%)] items-center gap-x-3 px-3.5 py-3 [grid-template-areas:'icon_text_money'] [overflow-wrap:anywhere] md:grid-cols-[36px_40px_minmax(0,1fr)_fit-content(40%)_16px] md:p-4 md:[grid-template-areas:'date_icon_text_money_action']"
          >
            <button
              type="button"
              data-expense-row={`${row.kind}-${record.id}`}
              className={rowButtonClass}
              aria-haspopup="dialog"
              aria-label={`View ${record.description}`}
              onClick={() => onOpen(row)}
            />
            <RowDate date={row.date} />
            <CategoryBadge
              category={categoryOf(record, activities)}
              iconOnly
              className="pointer-events-none size-10! [grid-area:icon]"
            />
            <span className="pointer-events-none grid gap-0.5 [grid-area:text]">
              <span className="text-[15px] leading-5 font-semibold md:text-base md:leading-[22px]">
                {record.description}
              </span>
              <span className="text-[13px] leading-5 text-muted-foreground">
                <span className="md:hidden">
                  {month} {day} ·{" "}
                </span>
                {row.kind === "loan" ? (
                  `Lent to ${name(row.record.to_user_id)}`
                ) : (
                  <>
                    {place}
                    <span className="max-md:hidden"> · Only you</span>
                  </>
                )}
              </span>
            </span>
            <span className="pointer-events-none grid gap-0.5 text-right tabular-nums [grid-area:money]">
              <span className="text-[15px] leading-5 font-semibold md:text-base md:leading-[22px]">
                {money(record.amount_minor, record.currency)}
              </span>
              <span
                className={`text-xs leading-5 font-semibold ${open ? "text-primary" : "text-muted-foreground"}`}
              >
                {row.kind === "loan"
                  ? loanStatus(row.left, record.currency, money)
                  : "Personal"}
              </span>
            </span>
            <CaretRightIcon
              aria-hidden="true"
              className="pointer-events-none hidden size-4 text-muted-foreground [grid-area:action] md:block"
            />
          </li>
        );
      })}
    </ol>
  );
}
