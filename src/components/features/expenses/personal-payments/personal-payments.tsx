"use client";

import { useEffect, useRef, useState } from "react";
import { activityKey, uncovered } from "@/lib/activity-expenses";
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
import { ExpensePaymentWorkspace } from "@/components/features/expenses/drawers/payment-workspace/expense-payment-workspace";
import { MarkAsPaidDialog } from "@/components/features/expenses/dialogs/mark-as-paid-dialog";
import { BalanceGroups } from "@/components/features/expenses/personal-payments/balance-groups";
import { MyExpensesSummary } from "@/components/features/expenses/personal-payments/my-expenses-summary";

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
        <MyExpensesSummary
          codes={codes}
          ownExpenses={ownExpenses}
          ledger={ledger}
          current={current}
          activityID={activityID}
          currency={currency}
          triggerRef={trigger}
          setCost={setCost}
        />
      )}
      <BalanceGroups
        business={business}
        debts={debts}
        codes={codes}
        showExpenses={showExpenses}
        activityID={activityID}
        current={current}
        name={name}
        currency={currency}
        triggerRef={trigger}
        receiptKeyRef={key}
        api={api}
        setCost={setCost}
        setDebt={setDebt}
        setDirty={setDirty}
      />
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
