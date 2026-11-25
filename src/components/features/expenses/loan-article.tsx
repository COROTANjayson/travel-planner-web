"use client";

import { rowDetail, rowTitle } from "@/components/features/expenses/card-row";
import type { ReactNode } from "react";
import type { ExpenseEditor } from "@/components/features/expenses/activity-expense-form/activity-expense-form";
import { Button } from "@/components/ui/button";
import { OptionsMenu } from "@/components/shared/options-menu";
import type {
  ActivityLedger,
  FinancialRecord,
  LedgerKind,
  Settlement,
  useExpensesApi,
} from "@/lib/expenses";
import type { Participant } from "@/lib/memberships";

export function LoanArticle({
  loan,
  data,
  current,
  writable,
  isEditor,
  flow,
  compact,
  managementOnly,
  name,
  money,
  open,
  reverse,
  api,
  receiptRows,
}: {
  loan: ActivityLedger["loans"][number];
  data: ActivityLedger;
  current?: Participant;
  writable: boolean;
  isEditor: boolean;
  flow: boolean;
  compact?: boolean;
  managementOnly?: boolean;
  name: (id: number) => string;
  money: (amount: string | bigint, currency: string) => string;
  open: (next: ExpenseEditor) => void;
  reverse: (kind: LedgerKind, record: FinancialRecord) => Promise<void>;
  api: Pick<ReturnType<typeof useExpensesApi>, "pending">;
  receiptRows: (receipts: Settlement[]) => ReactNode;
}) {
  const debt = data.debts.find((d) => d.loan_id === loan.id);
  const remaining = BigInt(debt?.amount_minor ?? loan.amount_minor);
  const receipts = data.settlements.filter((s) => s.loan_id === loan.id);
  const latestReceipt = [...receipts].sort((a, b) => b.id - a.id)[0];
  const canRemove =
    writable &&
    (isEditor ||
      (current?.user_id === loan.created_by_user_id &&
        current.user_id === loan.from_user_id));
  const status =
    remaining < 0n
      ? "Credit for review"
      : remaining === 0n
        ? "Paid"
        : remaining < BigInt(loan.amount_minor)
          ? "Partially paid"
          : "Unpaid";
  const options = [
    ...(writable && latestReceipt && current?.user_id === loan.from_user_id
      ? [
          {
            label: "Undo repayment",
            onClick: () => reverse("settlements", latestReceipt),
          },
        ]
      : []),
    ...(canRemove
      ? [
          {
            label: receipts.length
              ? "Remove loan (undo repayments first)"
              : "Remove loan",
            destructive: true,
            disabled: receipts.length > 0,
            onClick: () => reverse("expense_loans", loan),
          },
        ]
      : []),
  ];
  return (
    <article
      className={
        flow
          ? "px-3.5 py-3 [overflow-wrap:anywhere] sm:p-4"
          : "space-y-2 border-b border-border pt-[22px] pb-[13px] break-words last:border-b-0 last:pb-[30px]"
      }
    >
      {flow && !managementOnly && (
        <>
          <div className="flex items-center gap-3">
            <div className="grid min-w-0 flex-1 gap-0.5">
              <h4 className={rowTitle}>{name(loan.to_user_id)}</h4>
              <p className={rowDetail}>{loan.description}</p>
            </div>
            <div className="grid max-w-[50%] shrink-0 justify-items-end gap-0.5 text-right">
              <span className={`tabular-nums ${rowTitle}`}>
                {money(loan.amount_minor, loan.currency)}
              </span>
              <span className="text-[13px] leading-[21px] font-semibold text-muted-foreground">
                {status}
                {status === "Partially paid" &&
                  ` · ${money(remaining.toString(), loan.currency)} left`}
              </span>
            </div>
            {options.length > 0 && (
              <div className="activity-loan-options -mr-2 shrink-0">
                <OptionsMenu
                  name={`${name(loan.to_user_id)} · ${loan.description}`}
                  disabled={api.pending}
                  items={options}
                />
              </div>
            )}
          </div>
        </>
      )}
      {!flow && !managementOnly && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h4 className="min-w-0 flex-1 basis-40 text-lg font-bold">
              {loan.description}
            </h4>
            <span className="max-w-full shrink-0 text-base tabular-nums">
              {money(loan.amount_minor, loan.currency)}
            </span>
          </div>
          <p className="text-sm">
            {name(loan.to_user_id)} borrowed from {name(loan.from_user_id)}
          </p>
          <p className="text-sm text-muted-foreground">
            {status} · Outstanding {money(remaining, loan.currency)}
          </p>
          <div className="flex flex-wrap gap-2">
            {writable &&
              current?.user_id === loan.from_user_id &&
              debt &&
              remaining > 0n && (
                <Button
                  variant="outline"
                  disabled={api.pending}
                  onClick={() => open({ type: "repayment", debt })}
                >
                  Record repayment
                </Button>
              )}
          </div>
        </>
      )}
      {!flow && !compact && (
        <details>
          <summary className="min-h-11 cursor-pointer py-2 text-sm text-muted-foreground">
            {managementOnly
              ? `${loan.description} — loan history and corrections`
              : "Loan history and corrections"}
          </summary>
          <div className="space-y-3 pt-2 text-sm">
            <p>
              {name(loan.from_user_id)} lent{" "}
              {money(loan.amount_minor, loan.currency)} to{" "}
              {name(loan.to_user_id)} · {loan.paid_on}
            </p>
            {receiptRows(receipts)}
            {canRemove && (
              <>
                <Button
                  variant="ghost"
                  disabled={api.pending || receipts.length > 0}
                  onClick={() => void reverse("expense_loans", loan)}
                >
                  Remove loan
                </Button>
                {receipts.length > 0 && (
                  <p className="text-muted-foreground">
                    Reverse repayment receipts before removing this loan.
                  </p>
                )}
              </>
            )}
          </div>
        </details>
      )}
    </article>
  );
}
