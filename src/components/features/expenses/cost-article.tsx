"use client";

import type { RefObject, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import type { ExpenseEditor } from "@/components/features/expenses/activity-expense-form/activity-expense-form";
import { Button } from "@/components/ui/button";
import type {
  ActivityLedger,
  Expense,
  FinancialRecord,
  LedgerKind,
  Settlement,
  useExpensesApi,
} from "@/lib/expenses";

export function CostArticle({
  cost,
  data,
  flow,
  compact,
  managementOnly,
  isEditor,
  name,
  money,
  triggerRef,
  setPaymentCost,
  open,
  reverse,
  api,
  receiptRows,
}: {
  cost: Expense;
  data: ActivityLedger;
  flow: boolean;
  compact?: boolean;
  managementOnly?: boolean;
  isEditor: boolean;
  name: (id: number) => string;
  money: (amount: string | bigint, currency: string) => string;
  triggerRef: RefObject<HTMLElement | null>;
  setPaymentCost: (cost: Expense | null) => void;
  open: (next: ExpenseEditor) => void;
  reverse: (kind: LedgerKind, record: FinancialRecord) => Promise<void>;
  api: Pick<ReturnType<typeof useExpensesApi>, "pending">;
  receiptRows: (receipts: Settlement[]) => ReactNode;
}) {
  const payments = data.payments.filter((p) => p.expense_id === cost.id);
  const paid = payments.reduce((n, p) => n + BigInt(p.amount_minor), 0n);
  const equal = cost.shares.every(
    (s) => s.amount_minor === cost.shares[0]?.amount_minor,
  );
  const receipts = data.settlements.filter((s) =>
    payments.some((p) => p.id === s.payment_id),
  );
  return (
    <article
      className={
        flow
          ? "space-y-2 border-b border-border p-0 last:border-b-0"
          : "space-y-2 border-b border-border pt-[22px] pb-[13px] last:border-b-0 last:pb-[30px]"
      }
    >
      {flow && !managementOnly && (
        <Button
          variant="ghost"
          className="activity-expense-row h-auto min-h-11 w-full rounded-[6px] px-3 py-4 text-left whitespace-normal hover:bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] hover:text-foreground active:not-focus-visible:scale-100"
          aria-label={`View ${cost.description} payments`}
          onClick={(event) => {
            triggerRef.current = event.currentTarget;
            setPaymentCost(cost);
          }}
        >
          <span className="activity-expense-row-content [display:grid] [flex:1] [min-width:0] [gap:2px] [overflow-wrap:anywhere]">
            <span className="activity-expense-row-title [display:flex] [flex-wrap:wrap] [justify-content:space-between] [align-items:baseline] [gap:4px_20px] [font-size:15px] [line-height:22px]">
              <span className="min-w-0 flex-[1_1_140px] font-semibold">
                {cost.description}
              </span>
              <span className="activity-expense-row-price [display:inline-flex] [align-items:center] [gap:12px] [max-width:100%] [margin-left:auto] [font-size:14px] [font-weight:500] tabular-nums">
                {equal && cost.shares[0]
                  ? `${money(cost.shares[0].amount_minor, cost.currency)} each`
                  : money(cost.amount_minor, cost.currency)}
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 text-muted-foreground"
                  strokeWidth={1.75}
                />
              </span>
            </span>
            <span className="activity-expense-row-meta [color:var(--muted-foreground)] [font-size:13px] [line-height:20px] [font-weight:400]">
              {cost.shares.length}{" "}
              {cost.shares.length === 1 ? "person" : "people"}
              {" · "}
              {money(cost.amount_minor, cost.currency)} total
            </span>
            <span className="activity-expense-row-meta [color:var(--muted-foreground)] [font-size:13px] [line-height:20px] [font-weight:400]">
              {paid === 0n && !!cost.planned_coverer_user_id
                ? `${name(cost.planned_coverer_user_id)} will cover the ${money(cost.planned_cover_amount_minor ?? "0", cost.currency)} reservation`
                : paid > 0n
                  ? `${money(paid, cost.currency)} paid`
                  : "Not paid yet"}
            </span>
          </span>
        </Button>
      )}
      {!flow && !managementOnly && (
        <>
          <div className="activity-cost-title [display:flex] [justify-content:space-between] [gap:16px] [align-items:start]">
            <h4
              aria-label={cost.description}
              className="min-w-0 text-[18px] leading-[26px] font-bold [overflow-wrap:anywhere]"
            >
              <button
                type="button"
                className="-my-[9px] cursor-pointer py-[9px] text-left"
                onClick={(event) => {
                  triggerRef.current = event.currentTarget;
                  setPaymentCost(cost);
                }}
                aria-label={`View ${cost.description} payments`}
              >
                {cost.description}
              </button>
            </h4>
            <span className="max-w-[60%] text-base leading-[26px] [overflow-wrap:anywhere]">
              {equal && cost.shares[0]
                ? `${money(cost.shares[0].amount_minor, cost.currency)} each`
                : money(cost.amount_minor, cost.currency)}
            </span>
          </div>
          <p className="activity-cost-meta [font-size:14px] [line-height:24px] [color:var(--muted-foreground)] [margin-top:8px]">
            {cost.shares.length} people ·{" "}
            {money(cost.amount_minor, cost.currency)} total
          </p>
          {paid === 0n && !!cost.planned_coverer_user_id ? (
            <p className="activity-cost-status [font-size:14px] [line-height:24px] [color:var(--primary)] [margin-top:10px]">
              {name(cost.planned_coverer_user_id)} will cover the{" "}
              {money(cost.planned_cover_amount_minor ?? "0", cost.currency)}{" "}
              reservation
            </p>
          ) : (
            <p className="activity-cost-meta [font-size:14px] [line-height:24px] [color:var(--muted-foreground)] [margin-top:6px]">
              {paid > 0n
                ? `${money(paid, cost.currency)} paid to ${cost.description}`
                : "Not paid yet"}
            </p>
          )}
          {
            <Button
              variant="outline"
              className="activity-view-payments mt-1.5 min-h-12 w-full justify-start rounded-[999px] bg-transparent px-4 py-3 text-sm font-bold"
              onClick={(event) => {
                triggerRef.current = event.currentTarget;
                setPaymentCost(cost);
              }}
            >
              View payments
            </Button>
          }
        </>
      )}
      {managementOnly && <h4 className="font-semibold">{cost.description}</h4>}
      {!flow && !compact && (payments.length > 0 || isEditor) && (
        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground py-2">
            Payment history and corrections
          </summary>
          <div className="space-y-3 text-sm pt-2">
            {isEditor && (
              <Button
                variant="link"
                onClick={() => open({ type: "cost", cost })}
                aria-label={`Edit ${cost.description} expense`}
              >
                Edit expense
              </Button>
            )}
            {payments.map((p) => (
              <div key={p.id}>
                <p>
                  {name(p.payer_user_id)} paid{" "}
                  {money(p.amount_minor, p.currency)} to business · {p.paid_on}
                </p>
                {isEditor && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="ghost"
                      disabled={
                        api.pending ||
                        receipts.some((s) => s.payment_id === p.id)
                      }
                      onClick={() =>
                        open({
                          type: "payment",
                          cost,
                          payment: p,
                        })
                      }
                    >
                      Correct payment
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={
                        api.pending ||
                        receipts.some((s) => s.payment_id === p.id)
                      }
                      onClick={() => void reverse("expense_payments", p)}
                    >
                      Reverse payment
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {receiptRows(receipts)}
            {isEditor && !payments.length && (
              <Button
                variant="ghost"
                disabled={api.pending}
                onClick={() => void reverse("expenses", cost)}
              >
                Remove expense
              </Button>
            )}
          </div>
        </details>
      )}
    </article>
  );
}
