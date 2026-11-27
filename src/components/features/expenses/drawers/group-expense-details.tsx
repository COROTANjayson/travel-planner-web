"use client";

import Link from "next/link";
import { CaretRightIcon } from "@phosphor-icons/react";
import {
  rowDetail,
  rowTitle,
  cardRowClass,
} from "@/components/features/expenses/card-row";
import {
  activityPlace,
  DetailTotals,
} from "@/components/features/expenses/expense-list-parts";
import {
  ExpensePaymentWorkspace,
  type Context,
  type Screen,
} from "@/components/features/expenses/drawers/payment-workspace/expense-payment-workspace";
import { paidOnLabel } from "@/components/features/expenses/drawers/payment-workspace/payment-history";
import { CategoryBadge } from "@/components/features/itinerary/category-badge";
import { Button } from "@/components/ui/button";
import { memberPaymentState } from "@/lib/activity-expenses";
import { dateLabel } from "@/lib/activity-time";
import type { ActivityLedger } from "@/lib/expenses";
import type { Activity } from "@/lib/itinerary";
import { categoryOf } from "@/lib/expense-views";

/** What you owe or are owed on one expense, one line per person or business. */
function balances(
  cost: Context["cost"],
  ledger: ActivityLedger,
  me: number,
  name: (id: number) => string,
  money: (amount: string | bigint) => string,
) {
  const mine = memberPaymentState(cost, ledger, me);
  const lines: string[] = [];
  if (mine.business > 0n)
    lines.push(`You owe ${money(mine.business)} to the business`);
  for (const d of mine.debts)
    if (BigInt(d.amount_minor) > 0n)
      lines.push(`You owe ${money(d.amount_minor)} to ${name(d.to_user_id)}`);
  for (const d of ledger.debts)
    if (
      d.to_user_id === me &&
      ledger.payments.some(
        (p) => p.id === d.payment_id && p.expense_id === cost.id,
      )
    ) {
      const left = BigInt(d.amount_minor);
      if (left > 0n)
        lines.push(`${name(d.from_user_id)} owes you ${money(left)}`);
      if (left < 0n)
        lines.push(`You owe ${money(-left)} back to ${name(d.from_user_id)}`);
    }
  if (mine.credit > 0n)
    lines.push(`You have ${money(mine.credit)} credit to review`);
  return lines;
}

export function GroupExpenseDetails({
  ledger,
  activities,
  name,
  money,
  isEditor,
  pending,
  initialScreen,
  onEdit,
  onDelete,
  ...props
}: Context & {
  ledger: ActivityLedger;
  activities: Activity[];
  name: (id: number) => string;
  money: (amount: string | bigint, currency: string) => string;
  isEditor: boolean;
  pending: boolean;
  initialScreen?: Screen;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { cost, trip, current } = props;
  const me = current?.user_id ?? 0;
  const amount = (value: string | bigint) => money(value, cost.currency);
  const share = cost.shares.find((s) => s.user_id === me)?.amount_minor ?? "0";
  const lines = balances(cost, ledger, me, name, amount);
  const who = (id: number) => (id === me ? "You" : name(id));
  const to = (id: number) => (id === me ? "you" : name(id));
  return (
    <ExpensePaymentWorkspace
      {...props}
      backLabel="Back to expenses"
      details={{
        initialScreen,
        badge: <CategoryBadge category={categoryOf(cost, activities)} />,
        description: `${activityPlace(cost, activities)} · ${dateLabel(cost.incurred_on)}`,
        intro: (
          <>
            <DetailTotals
              items={[
                ["Total", amount(cost.amount_minor)],
                ["Your share", amount(share)],
              ]}
            />
            {lines.length > 0 && (
              <ul className="space-y-1 text-[13px] leading-[21px] font-semibold [overflow-wrap:anywhere]">
                {lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
            {cost.prep_task_id ? (
              <div className="overflow-hidden rounded-[16px] border bg-card">
                <Button
                  variant="ghost"
                  className={cardRowClass}
                  nativeButton={false}
                  render={
                    <Link
                      href={`/trips/${trip.id}/prep?task=${cost.prep_task_id}`}
                    />
                  }
                >
                  <span className="grid min-w-0 gap-0.5 [overflow-wrap:anywhere]">
                    <span className={rowTitle}>{cost.prep_task_name}</span>
                    <span className={rowDetail}>Prep task</span>
                  </span>
                  <CaretRightIcon
                    aria-hidden="true"
                    className="text-muted-foreground"
                  />
                </Button>
              </div>
            ) : cost.prep_task_name ? (
              <p className="text-sm leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                From a deleted Prep task: {cost.prep_task_name}
              </p>
            ) : null}
            {!isEditor && (
              <p className="rounded-xl bg-muted p-3 text-sm leading-5 text-muted-foreground">
                Only editors can change group expenses.
              </p>
            )}
            <h3 className={rowTitle}>Who’s in</h3>
          </>
        ),
        after: (status) => {
          const records = [
            ...status.payments.map((p) => ({
              key: `payment-${p.id}`,
              title: `${who(p.payer_user_id)} paid the business`,
              date: p.paid_on,
              amount: p.amount_minor,
            })),
            ...status.receipts.map((r) => ({
              key: `receipt-${r.id}`,
              title: `${who(r.from_user_id)} paid ${to(r.to_user_id)}`,
              date: r.paid_on,
              amount: r.amount_minor,
            })),
          ].sort((a, b) => b.date.localeCompare(a.date));
          return (
            <section aria-label="Payments" className="space-y-4">
              <h3 className={rowTitle}>Payments</h3>
              {records.length ? (
                <ul className="divide-y overflow-hidden rounded-[16px] border bg-card">
                  {records.map((r) => (
                    <li
                      key={r.key}
                      className="flex items-center justify-between gap-3 px-3.5 py-3 [overflow-wrap:anywhere] sm:p-4"
                    >
                      <span className="grid min-w-0 gap-0.5">
                        <span className={rowTitle}>{r.title}</span>
                        <span className={rowDetail}>{paidOnLabel(r.date)}</span>
                      </span>
                      <span
                        className={`max-w-[50%] text-right tabular-nums ${rowTitle}`}
                      >
                        {amount(r.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm leading-5 text-muted-foreground">
                  No payments recorded yet.
                </p>
              )}
            </section>
          );
        },
        footer: (record) =>
          isEditor ? (
            <div className="grid grid-cols-[1fr_auto] items-center gap-3 md:flex [&_[data-slot=button]]:justify-center!">
              <Button
                variant="link"
                className="text-destructive max-md:order-3 md:mr-auto"
                disabled={pending}
                onClick={onDelete}
              >
                Delete
              </Button>
              <Button
                variant="outline"
                className="max-md:order-2"
                disabled={pending}
                onClick={onEdit}
              >
                Edit expense
              </Button>
              {record && (
                <Button
                  className="max-md:order-1 max-md:col-span-2"
                  disabled={pending}
                  onClick={record}
                >
                  Record a payment
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm leading-5 text-muted-foreground [overflow-wrap:anywhere]">
              Created by {to(cost.created_by_user_id)}
            </p>
          ),
      }}
    />
  );
}
