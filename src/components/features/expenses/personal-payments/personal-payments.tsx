"use client";

import { useEffect, useRef, useState } from "react";
import {
  activityKey,
  uncovered,
  memberPaymentState,
  personalTotals,
} from "@/lib/activity-expenses";
import {
  expenseName,
  useExpensesApi,
  type ActivityLedger,
  type Currency,
  type Debt,
  type Expense,
} from "@/lib/expenses";
import type { Participant } from "@/lib/memberships";
import type { Trip } from "@/lib/trips";
import { expenseMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { ExpensePaymentWorkspace } from "@/components/features/expenses/drawers/payment-workspace/expense-payment-workspace";
import { MarkAsPaidDialog } from "@/components/features/expenses/dialogs/mark-as-paid-dialog";

export function PersonalPayments({
  trip,
  current,
  participants,
  ledger,
  currencies,
  activityID,
  showExpenses = false,
  onFailure,
}: {
  trip: Trip;
  current?: Participant;
  participants?: Participant[];
  ledger: ActivityLedger;
  currencies: Currency[];
  activityID?: string;
  showExpenses?: boolean;
  onFailure: (error: Error) => void | Promise<void>;
}) {
  const api = useExpensesApi(trip.id, onFailure);
  const [debt, setDebt] = useState<Debt | null>(null);
  const [cost, setCost] = useState<Expense | null>(null);
  const [dirty, setDirty] = useState(false);
  const key = useRef("");
  const trigger = useRef<HTMLElement | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const people = [
    ...new Map(
      [...ledger.people, ...(participants ?? [])].map((p) => [p.user_id, p]),
    ).values(),
  ];
  const name = (id: number) =>
    expenseName(people.find((p) => p.user_id === id));
  const currency = (code: string) =>
    currencies.find((c) => c.code === code) ?? { code, decimals: 2 };
  const matches = (record: { activity_id?: number; activity_name?: string }) =>
    !activityID || activityKey(record) === activityID;
  const business = ledger.expenses.filter(matches).flatMap((expense) => {
    const amount = BigInt(
      uncovered(expense, ledger).find((s) => s.user_id === current?.user_id)
        ?.amount_minor ?? "0",
    );
    return amount === 0n ? [] : [{ expense, amount }];
  });
  const ownExpenses = ledger.expenses.filter(
    (expense) =>
      matches(expense) &&
      expense.shares.some((s) => s.user_id === current?.user_id),
  );
  const debts = ledger.debts.filter(
    (d) =>
      matches(d) &&
      (d.from_user_id === current?.user_id ||
        d.to_user_id === current?.user_id) &&
      BigInt(d.amount_minor) !== 0n,
  );
  const codes = [
    ...new Set([
      ...(showExpenses ? ownExpenses.map((e) => e.currency) : []),
      ...business.map((b) => b.expense.currency),
      ...debts.map((d) => d.currency),
    ]),
  ];
  const finalFocus = () =>
    trigger.current?.isConnected ? trigger.current : heading.current;
  function close() {
    if (
      api.pending ||
      (dirty && !window.confirm("Discard unsaved payment changes?"))
    )
      return;
    setDebt(null);
    setDirty(false);
    api.reset();
  }
  if (!current) return null;
  return (
    <section className="space-y-4" aria-label="My payments">
      <h3
        ref={heading}
        tabIndex={-1}
        className={showExpenses ? "sr-only" : "text-lg font-semibold"}
      >
        {showExpenses ? "My Expenses" : "My payments"}
      </h3>
      {showExpenses && (
        <>
          {!codes.length && (
            <p className="text-muted-foreground">
              You have no expenses or balances for this activity.
            </p>
          )}
          {codes.map((code) => {
            const expenses = ownExpenses.filter((e) => e.currency === code);
            const totals = personalTotals(
              ledger,
              current.user_id,
              code,
              activityID,
            );
            const paid = expenses.reduce(
              (sum, e) =>
                sum + memberPaymentState(e, ledger, current.user_id).paid,
              0n,
            );
            const money = (amount: bigint) =>
              expenseMoney(String(amount), currency(code));
            return (
              <div key={code} className="space-y-3">
                <dl className="personal-expense-summary">
                  <div>
                    <dt>Your share</dt>
                    <dd>{money(totals.cost)}</dd>
                  </div>
                  <div>
                    <dt>Paid</dt>
                    <dd>{money(paid)}</dd>
                  </div>
                  <div>
                    <dt>To pay</dt>
                    <dd>{money(totals.remaining)}</dd>
                  </div>
                </dl>
                {!!expenses.length && (
                  <ul className="divide-y">
                    {expenses.map((expense) => {
                      const status = memberPaymentState(
                        expense,
                        ledger,
                        current.user_id,
                      );
                      return (
                        <li key={expense.id}>
                          <button
                            type="button"
                            className="personal-expense-row"
                            aria-label={`View ${expense.description} payments`}
                            onClick={(event) => {
                              trigger.current = event.currentTarget;
                              setCost(expense);
                            }}
                          >
                            <span>
                              <strong>{expense.description}</strong>
                              <span className="block text-sm text-muted-foreground">
                                {status.status}
                                {status.remaining > 0n
                                  ? ` · ${money(status.remaining)} left`
                                  : ""}
                              </span>
                            </span>
                            <span className="tabular-nums">
                              {money(status.share)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </>
      )}
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
                            trigger.current = event.currentTarget;
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
                                  trigger.current = event.currentTarget;
                                  key.current = crypto.randomUUID();
                                  api.reset();
                                  setDirty(false);
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
      {cost && (
        <ExpensePaymentWorkspace
          trip={trip}
          current={current}
          participants={participants}
          cost={ledger.expenses.find((e) => e.id === cost.id) ?? cost}
          currency={currency(cost.currency)}
          finalFocus={finalFocus}
          onBack={() => setCost(null)}
          backLabel={showExpenses ? "Back to My Expenses" : undefined}
          onFailure={onFailure}
        />
      )}
      <MarkAsPaidDialog
        debt={debt}
        setDebt={setDebt}
        setDirty={setDirty}
        api={api}
        people={people}
        currencies={currencies}
        current={current}
        participants={participants}
        trip={trip}
        ledger={ledger}
        close={close}
        finalFocus={finalFocus}
        receiptKey={key}
      />
    </section>
  );
}
