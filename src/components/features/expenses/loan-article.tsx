"use client";

import type { ReactNode } from "react";
import type { ExpenseEditor } from "@/components/features/expenses/activity-expense-form/activity-expense-form";
import { cn } from "@/lib/utils";
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
  const canReceive =
    writable &&
    current?.user_id === loan.from_user_id &&
    debt &&
    remaining > 0n;
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
          ? "relative border-b border-border p-3 last:border-b-0 [overflow-wrap:anywhere]"
          : "space-y-2 border-b border-border pt-[22px] pb-[13px] break-words last:border-b-0 last:pb-[30px]"
      }
    >
      {flow && !managementOnly && (
        <>
          {options.length > 0 && (
            <div className="activity-loan-options [position:absolute] [top:2px] [right:0] [margin:0]">
              <OptionsMenu
                name={`${name(loan.to_user_id)} · ${loan.description}`}
                disabled={api.pending}
                items={options}
              />
            </div>
          )}
          <div
            className={cn(
              "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm leading-[22px] max-[480px]:block",
              options.length > 0 && "pr-11",
            )}
          >
            <div className="min-w-0 flex-[1_1_180px]">
              <h4 className="min-w-0 text-[15px] font-semibold">
                {name(loan.to_user_id)}
              </h4>
              <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">
                {loan.description}
              </p>
            </div>
            <div className="ml-auto max-w-full text-right max-[480px]:mt-1 max-[480px]:flex max-[480px]:flex-wrap max-[480px]:items-baseline max-[480px]:gap-x-2 max-[480px]:gap-y-0.5 max-[480px]:text-left">
              <span className="font-semibold tabular-nums">
                {money(loan.amount_minor, loan.currency)}
              </span>
              <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">
                {status}
                {remaining !== 0n &&
                  ` · Outstanding ${money(remaining.toString(), loan.currency)}`}
              </p>
            </div>
          </div>
          {canReceive && (
            <div
              className={cn(
                "mt-0.5 flex flex-wrap items-center justify-end gap-x-3 gap-y-0",
                options.length > 0 && "pr-11",
              )}
            >
              <Button
                variant="link"
                className="-my-2 min-h-11 px-0 py-2 [font-size:13px]"
                disabled={api.pending}
                onClick={() => open({ type: "repayment", debt })}
              >
                Record repayment
              </Button>
            </div>
          )}
        </>
      )}
      {!flow && !managementOnly && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h4
              className={`min-w-0 flex-1 basis-40 ${flow ? "text-base font-semibold" : "text-lg font-bold"}`}
            >
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
                  : "Unpaid"}
            {(!flow || remaining !== 0n) &&
              ` · Outstanding ${money(remaining.toString(), loan.currency)}`}
          </p>
          <div className="flex flex-wrap gap-2">
            {writable &&
              current?.user_id === loan.from_user_id &&
              debt &&
              remaining > 0n && (
                <Button
                  variant={flow ? "link" : "outline"}
                  className={flow ? "min-h-11 px-0 py-2" : undefined}
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
