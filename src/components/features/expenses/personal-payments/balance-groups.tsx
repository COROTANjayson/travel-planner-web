"use client";

import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import type { Currency, Debt, Expense, useExpensesApi } from "@/lib/expenses";
import type { Participant } from "@/lib/memberships";
import { expenseMoney } from "@/lib/money";

export function BalanceGroups({
  business,
  debts,
  codes,
  showExpenses,
  activityID,
  current,
  name,
  currency,
  triggerRef,
  receiptKeyRef,
  api,
  setCost,
  setDebt,
}: {
  business: { expense: Expense; amount: bigint }[];
  debts: Debt[];
  codes: string[];
  showExpenses: boolean;
  activityID?: string;
  current: Participant;
  name: (id: number) => string;
  currency: (code: string) => Currency;
  triggerRef: RefObject<HTMLElement | null>;
  receiptKeyRef: RefObject<string>;
  api: Pick<ReturnType<typeof useExpensesApi>, "reset">;
  setCost: (cost: Expense | null) => void;
  setDebt: (debt: Debt | null) => void;
}) {
  return (
    <>
      {(["To pay", "Owed to me"] as const).map((title) => {
        const payable = title === "To pay";
        const ownBusiness = business.filter(
          (b) => (!showExpenses || !payable) && b.amount > 0n === payable,
        );
        const ownDebts = debts.filter((d) => {
          const debtor =
            BigInt(d.amount_minor) > 0n ? d.from_user_id : d.to_user_id;
          return (debtor === current.user_id) === payable;
        });
        if (showExpenses && !ownBusiness.length && !ownDebts.length)
          return null;
        return (
          <div key={title} className="space-y-2">
            {!showExpenses && <h4 className="font-semibold">{title}</h4>}
            {!ownBusiness.length && !ownDebts.length && (
              <p className="text-sm text-muted-foreground">
                {payable
                  ? showExpenses
                    ? "No reimbursements or loans to pay."
                    : "Nothing to pay."
                  : "Nothing owed to you."}
              </p>
            )}
            {codes.map((code) => {
              const costs = ownBusiness.filter(
                (b) => b.expense.currency === code,
              );
              const balances = ownDebts.filter((d) => d.currency === code);
              if (!costs.length && !balances.length) return null;
              const absolute = (amount: bigint) =>
                amount < 0n ? -amount : amount;
              const money = (amount: bigint) =>
                expenseMoney(String(absolute(amount)), currency(code));
              const total =
                costs.reduce((n, b) => n + absolute(b.amount), 0n) +
                balances.reduce(
                  (n, d) => n + absolute(BigInt(d.amount_minor)),
                  0n,
                );
              return (
                <div key={code} className="space-y-2 text-sm">
                  {showExpenses ? (
                    <div className="personal-balance-heading">
                      <h4>{payable ? "You owe" : "Owed to you"}</h4>
                      <p className="tabular-nums">{money(total)}</p>
                    </div>
                  ) : (
                    <p className="font-semibold tabular-nums">
                      {title}: {money(total)}
                    </p>
                  )}
                  <ul className="divide-y">
                    {costs.map(({ expense, amount }) => (
                      <li
                        key={`cost-${expense.id}`}
                        className="flex flex-wrap items-center justify-between gap-3 py-3"
                      >
                        <div className="min-w-0 flex-1 basis-40 break-words">
                          <p className="font-medium">{expense.description}</p>
                          <p className="text-muted-foreground">
                            {!activityID && (
                              <>{expense.activity_name || "Activity"} · </>
                            )}
                            {amount > 0n
                              ? "Pay to business"
                              : "Business credit for review"}
                          </p>
                          <p className="tabular-nums">{money(amount)}</p>
                        </div>
                        <Button
                          variant="outline"
                          onClick={(event) => {
                            triggerRef.current = event.currentTarget;
                            setCost(expense);
                          }}
                        >
                          View payments
                        </Button>
                      </li>
                    ))}
                    {balances.map((d) => (
                      <li
                        key={`${d.payment_id ? "payment" : "loan"}-${d.payment_id ?? d.loan_id}-${d.from_user_id}-${d.to_user_id}`}
                        className={
                          showExpenses
                            ? "personal-balance-row"
                            : "flex flex-wrap items-center justify-between gap-3 py-3"
                        }
                      >
                        <div className="min-w-0 flex-1 basis-40 break-words">
                          {showExpenses ? (
                            <>
                              <p className="font-medium">
                                {name(
                                  d.from_user_id === current.user_id
                                    ? d.to_user_id
                                    : d.from_user_id,
                                )}
                              </p>
                              <p className="text-muted-foreground">
                                {d.description}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="font-medium">{d.description}</p>
                              <p className="text-muted-foreground">
                                {!activityID && (
                                  <>{d.activity_name || "Activity"} · </>
                                )}
                                {d.loan_id
                                  ? payable
                                    ? "Borrowed money"
                                    : "Loan repayment"
                                  : "Expense reimbursement"}
                              </p>
                            </>
                          )}
                          {!showExpenses && (
                            <p>
                              {payable ? "To" : "From"}{" "}
                              {name(
                                d.from_user_id === current.user_id
                                  ? d.to_user_id
                                  : d.from_user_id,
                              )}{" "}
                              ·{" "}
                              <span className="tabular-nums">
                                {money(BigInt(d.amount_minor))}
                              </span>
                            </p>
                          )}
                          {BigInt(d.amount_minor) < 0n && (
                            <p className="text-muted-foreground">
                              Credit for review
                            </p>
                          )}
                        </div>
                        <div
                          className={
                            showExpenses
                              ? "personal-balance-actions"
                              : "contents"
                          }
                        >
                          {showExpenses && (
                            <p className="tabular-nums">
                              {money(BigInt(d.amount_minor))}
                            </p>
                          )}
                          {!payable &&
                            current.role !== "viewer" &&
                            BigInt(d.amount_minor) > 0n && (
                              <Button
                                variant={showExpenses ? "link" : "outline"}
                                size={showExpenses ? "sm" : "default"}
                                className={
                                  showExpenses
                                    ? "personal-balance-action"
                                    : undefined
                                }
                                aria-label={
                                  showExpenses
                                    ? `Mark ${money(BigInt(d.amount_minor))} from ${name(d.from_user_id)} as paid`
                                    : undefined
                                }
                                onClick={(event) => {
                                  triggerRef.current = event.currentTarget;
                                  receiptKeyRef.current = crypto.randomUUID();
                                  api.reset();
                                  setDebt(d);
                                }}
                              >
                                Mark as paid
                              </Button>
                            )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
