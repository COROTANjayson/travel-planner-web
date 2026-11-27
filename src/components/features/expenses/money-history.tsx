"use client";

import type { ReactNode } from "react";
import { rowDetail, rowTitle } from "@/components/features/expenses/card-row";
import { paidOnLabel } from "@/components/features/expenses/drawers/payment-workspace/payment-history";
import { loanStatus } from "@/components/features/expenses/personal-expense-list";
import { Button } from "@/components/ui/button";
import { borrowedLoans, loanLeft } from "@/lib/expense-views";
import type { ActivityLedger, Debt, Settlement } from "@/lib/expenses";

function Section({
  title,
  detail,
  empty,
  children,
}: {
  title: string;
  detail?: string;
  empty: string;
  children: ReactNode[];
}) {
  return (
    <section aria-label={title} className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className={rowTitle}>{title}</h3>
        {detail && (
          <p className="text-sm font-semibold tabular-nums">{detail}</p>
        )}
      </div>
      {children.length ? (
        <ul className="divide-y overflow-hidden rounded-[16px] border bg-card">
          {children}
        </ul>
      ) : (
        <p className="text-sm leading-5 text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

const rowClass =
  "flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3.5 py-3 [overflow-wrap:anywhere] sm:p-4";

/** Trip-wide money that Group and Personal don't list: borrowed, reimbursements, receipts. */
export function MoneyHistory({
  data,
  me,
  writable,
  pending,
  name,
  money,
  receiptRows,
  onReceive,
}: {
  data: ActivityLedger;
  me: number;
  writable: boolean;
  pending: boolean;
  name: (id: number) => string;
  money: (amount: string | bigint, currency: string) => string;
  receiptRows: (receipts: Settlement[]) => ReactNode;
  onReceive: (debt: Debt) => void;
}) {
  const borrowed = borrowedLoans(data, me);
  const open = new Map<string, bigint>();
  for (const loan of borrowed) {
    const left = loanLeft(data, loan);
    if (left > 0n)
      open.set(loan.currency, (open.get(loan.currency) ?? 0n) + left);
  }
  const owed = data.debts.filter(
    (d) => d.payment_id && d.to_user_id === me && BigInt(d.amount_minor) > 0n,
  );
  const receipts = data.settlements
    .filter((s) => s.payment_id || s.loan_id)
    .sort((a, b) => b.paid_on.localeCompare(a.paid_on) || b.id - a.id);
  return (
    <>
      <Section
        title="Money you borrowed"
        detail={
          open.size
            ? `${[...open].map(([code, left]) => money(left, code)).join(" · ")} to repay`
            : undefined
        }
        empty="You haven’t borrowed any money on this trip."
      >
        {borrowed.map((loan) => (
          <li key={loan.id} className={rowClass}>
            <span className="grid min-w-0 gap-0.5">
              <span className={rowTitle}>{loan.description}</span>
              <span className={rowDetail}>
                From {name(loan.from_user_id)} · {paidOnLabel(loan.paid_on)}
              </span>
            </span>
            <span className="grid justify-items-end gap-0.5 text-right tabular-nums">
              <span className={rowTitle}>
                {money(loan.amount_minor, loan.currency)}
              </span>
              <span className="text-xs leading-5 font-semibold text-muted-foreground">
                {loanStatus(loanLeft(data, loan), loan.currency, money)}
              </span>
            </span>
          </li>
        ))}
      </Section>
      <Section
        title="Reimbursements owed to you"
        empty="Nobody owes you a reimbursement."
      >
        {owed.map((d) => (
          <li key={`${d.payment_id}-${d.from_user_id}`} className={rowClass}>
            <span className="grid min-w-0 gap-0.5">
              <span className={rowTitle}>{name(d.from_user_id)}</span>
              <span className={rowDetail}>{d.description}</span>
            </span>
            <span className="grid justify-items-end text-right tabular-nums">
              <span className={rowTitle}>
                {money(d.amount_minor, d.currency)}
              </span>
              {writable && (
                <Button
                  variant="link"
                  className="min-h-11 px-0"
                  disabled={pending}
                  aria-label={`Mark paid: ${name(d.from_user_id)}, ${d.description}`}
                  onClick={() => onReceive(d)}
                >
                  Mark paid
                </Button>
              )}
            </span>
          </li>
        ))}
      </Section>
      <section aria-label="Repayment history" className="space-y-3">
        <h3 className={rowTitle}>Repayment history</h3>
        {receipts.length ? (
          <div className="space-y-4 rounded-[16px] border bg-card px-3.5 py-3 text-sm [overflow-wrap:anywhere] sm:p-4">
            {receiptRows(receipts)}
          </div>
        ) : (
          <p className="text-sm leading-5 text-muted-foreground">
            No repayments recorded yet.
          </p>
        )}
      </section>
    </>
  );
}
