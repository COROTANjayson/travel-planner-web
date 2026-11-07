"use client";

import type { ReactNode } from "react";
import type { ActivityExpenseView } from "@/components/features/expenses/activity-expenses";
import type { ExpenseEditor } from "@/components/features/expenses/activity-expense-form/activity-expense-form";
import { Button } from "@/components/ui/button";
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
  view,
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
  view?: ActivityExpenseView;
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
  return (
    <article className="space-y-2 py-5 break-words">
      {!managementOnly && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h4 className="min-w-0 flex-1 basis-40 text-lg font-bold">
              {flow ? name(loan.to_user_id) : loan.description}
            </h4>
            <span className="max-w-full shrink-0 text-base tabular-nums">
              {money(loan.amount_minor, loan.currency)}
              {flow ? " total" : ""}
            </span>
          </div>
          {flow && (
            <p className="text-sm text-muted-foreground">{loan.description}</p>
          )}
          {!flow && (
            <p className="text-sm">
              {name(loan.to_user_id)} borrowed from {name(loan.from_user_id)}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {remaining < 0n
              ? "Credit for review"
              : remaining === 0n
                ? "Paid"
                : remaining < BigInt(loan.amount_minor)
                  ? "Partially paid"
                  : "Unpaid"}{" "}
            · Outstanding {money(remaining.toString(), loan.currency)}
          </p>
          <div className="flex flex-wrap gap-2">
            {writable &&
              current?.user_id === loan.from_user_id &&
              debt &&
              remaining > 0n && (
                <Button
                  variant="outline"
                  onClick={() => open({ type: "repayment", debt })}
                >
                  Mark as paid
                </Button>
              )}
            {flow &&
              writable &&
              latestReceipt &&
              current?.user_id === loan.from_user_id && (
                <Button
                  variant="outline"
                  disabled={api.pending}
                  onClick={async (event) => {
                    const button = event.currentTarget;
                    const title = button
                      .closest("[role='dialog']")
                      ?.querySelector<HTMLElement>("h2");
                    await reverse("settlements", latestReceipt);
                    if (!button.isConnected)
                      title?.focus({ preventScroll: true });
                  }}
                >
                  Undo
                </Button>
              )}
          </div>
        </>
      )}
      {(!compact || (flow && view === "loans")) && (
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
