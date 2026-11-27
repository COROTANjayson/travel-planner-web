"use client";

import {
  CaretRightIcon,
  PencilSimpleIcon,
  ReceiptIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { CategoryBadge } from "@/components/features/itinerary/category-badge";
import {
  activityPlace,
  expenseListClass,
  RowDate,
  rowButtonClass,
} from "@/components/features/expenses/expense-list-parts";
import { OptionsMenu } from "@/components/shared/options-menu";
import { monthDay } from "@/lib/activity-time";
import type { GroupRow } from "@/lib/expense-views";
import type { Expense } from "@/lib/expenses";
import type { Activity } from "@/lib/itinerary";
import { categoryOf } from "@/lib/expense-views";

type Money = (amount: string | bigint, currency: string) => string;

export const peopleCount = (n: number) =>
  `${n} ${n === 1 ? "person" : "people"}`;

/** Your own state on the expense first, then the group's. */
export function rowStatus(row: GroupRow, money: Money) {
  const code = row.expense.currency;
  if (row.owe > 0n)
    return { label: "You owe", amount: money(row.owe, code), tone: "owe" };
  if (row.owed > 0n)
    return {
      label: row.owed > row.credit ? "Owed to you" : "Credit for review",
      amount: money(row.owed, code),
      tone: "owed",
    };
  if (row.needsPayment) return { label: "Needs payment", tone: "payment" };
  return { label: row.settled ? "Settled" : "Credit for review", tone: "done" };
}

export function progressText(row: GroupRow, money: Money) {
  const code = row.expense.currency;
  const people = `${row.paidPeople} of ${peopleCount(row.people)}`;
  if (row.settled) return `All paid · ${people}`;
  return `${money(row.paid, code)} of ${money(row.total, code)} paid${row.covered ? " back" : ""} · ${row.noPayer ? "no payer yet" : people}`;
}

const tones: Record<string, string> = {
  owe: "text-destructive",
  owed: "text-primary",
  payment: "text-[#625333]",
  done: "text-muted-foreground",
};

export function GroupExpenseList({
  rows,
  activities,
  name,
  money,
  isEditor,
  disabled,
  onOpen,
  onPay,
  onEdit,
  onDelete,
}: {
  rows: GroupRow[];
  activities: Activity[];
  name: (id: number) => string;
  money: Money;
  isEditor: boolean;
  disabled: boolean;
  onOpen: (expense: Expense) => void;
  onPay: (expense: Expense) => void;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
}) {
  return (
    <ol className={expenseListClass} aria-label="Group expenses">
      {rows.map((row) => {
        const e = row.expense;
        const { month, day } = monthDay(e.incurred_on);
        const status = rowStatus(row, money);
        const detail = [
          activityPlace(e, activities),
          e.prep_task_id || e.prep_task_name ? "From Prep" : "",
          row.payers.length === 1
            ? `Paid by ${name(row.payers[0])}`
            : row.payers.length
              ? `Paid by ${peopleCount(row.payers.length)}`
              : e.planned_coverer_user_id
                ? `${name(e.planned_coverer_user_id)} will pay first`
                : "",
          peopleCount(row.people),
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <li
            key={e.id}
            className="relative grid grid-cols-[18px_minmax(0,1fr)_44px] items-center gap-x-2 gap-y-2 p-4 [grid-template-areas:'icon_title_action'_'detail_detail_detail'_'money_money_money'_'state_state_state'] [overflow-wrap:anywhere] md:grid-cols-[36px_40px_minmax(0,1fr)_fit-content(40%)_44px] md:gap-x-3 md:gap-y-1 md:py-3.5 md:pr-2 md:[grid-template-areas:'date_icon_title_total_action'_'date_icon_detail_share_action'_'date_icon_progress_status_action']"
          >
            <button
              type="button"
              data-expense-row={`group-${e.id}`}
              className={rowButtonClass}
              aria-haspopup="dialog"
              aria-label={`View ${e.description}`}
              onClick={() => onOpen(e)}
            />
            <RowDate date={e.incurred_on} />
            <CategoryBadge
              category={categoryOf(e, activities)}
              iconOnly
              className="pointer-events-none [grid-area:icon] max-md:size-[18px]! max-md:bg-transparent! max-md:text-muted-foreground! md:size-10! max-md:[&_svg]:size-[18px]!"
            />
            <span className="pointer-events-none text-[15px] leading-5 font-semibold [grid-area:title] md:text-base md:leading-[22px]">
              {e.description}
            </span>
            <span className="pointer-events-none text-[13px] leading-5 text-muted-foreground [grid-area:detail]">
              <span className="md:hidden">
                {month} {day} ·{" "}
              </span>
              {detail}
            </span>
            <span className="pointer-events-none hidden min-w-0 items-center gap-2 text-xs leading-4 text-muted-foreground [grid-area:progress] md:flex">
              <span
                aria-hidden="true"
                className="h-1 w-[120px] shrink-0 overflow-hidden rounded-full bg-muted"
              >
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{
                    width: `${Number((row.paid * 100n) / row.total)}%`,
                    minWidth: row.paid > 0n ? 2 : 0,
                  }}
                />
              </span>
              <span className="min-w-0">{progressText(row, money)}</span>
            </span>
            <span className="pointer-events-none flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 [grid-area:money] md:contents">
              <span className="pointer-events-none min-w-0 text-[15px] leading-5 font-semibold tabular-nums [grid-area:total] md:text-right md:text-base md:leading-[22px]">
                {money(row.total, e.currency)}
              </span>
              <span className="pointer-events-none min-w-0 text-right text-xs leading-4 text-muted-foreground tabular-nums [grid-area:share]">
                Your share {money(row.share, e.currency)}
              </span>
            </span>
            <span className="pointer-events-none flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 [grid-area:state] md:contents">
              <span
                data-tone={status.tone}
                className={`pointer-events-none min-w-0 text-xs leading-5 font-semibold tabular-nums [grid-area:status] md:text-right ${tones[status.tone]}`}
              >
                {status.label}
                {status.amount && (
                  <span className="max-md:sr-only"> {status.amount}</span>
                )}
              </span>
              <span className="pointer-events-none text-right text-xs leading-4 text-muted-foreground [grid-area:short] md:hidden">
                {row.paidPeople} of {row.people} paid
              </span>
            </span>
            <span className="relative grid size-11 place-items-center text-muted-foreground [grid-area:action] not-has-[button]:pointer-events-none">
              {isEditor ? (
                <OptionsMenu
                  name={e.description}
                  description={`${money(row.total, e.currency)} · ${row.paidPeople} of ${row.people} paid`}
                  disabled={disabled}
                  items={[
                    {
                      label: "Record a payment",
                      icon: <ReceiptIcon aria-hidden="true" />,
                      onClick: () => onPay(e),
                    },
                    {
                      label: "Edit expense",
                      icon: <PencilSimpleIcon aria-hidden="true" />,
                      onClick: () => onEdit(e),
                    },
                    {
                      label: "Delete",
                      icon: <TrashIcon aria-hidden="true" />,
                      destructive: true,
                      onClick: () => onDelete(e),
                    },
                  ]}
                />
              ) : (
                <CaretRightIcon aria-hidden="true" className="size-4" />
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
