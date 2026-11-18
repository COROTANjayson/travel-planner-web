"use client";

import { ExpenseAmountPanel } from "@/components/features/expenses/expense-amount-panel";

import { ExpenseSelect } from "@/components/features/expenses/expense-forms";
import { ExpenseNumberInput } from "@/components/features/expenses/expense-number-input";
import { expenseName, type Currency, type ExpensePerson } from "@/lib/expenses";

export function CovererStep({
  formID,
  coverer,
  setCoverer,
  coverAmount,
  setCoverAmount,
  currency,
  people,
}: {
  formID: string;
  coverer: number;
  setCoverer: (coverer: number) => void;
  coverAmount: string;
  setCoverAmount: (amount: string) => void;
  currency: Currency;
  people: ExpensePerson[];
}) {
  return (
    <>
      <ExpenseSelect
        id={`${formID}-coverer`}
        label="Who will pay first?"
        value={String(coverer)}
        options={[
          { value: "0", label: "Decide later" },
          ...people.map((person) => ({
            value: String(person.user_id),
            label: expenseName(person),
          })),
        ]}
        onChange={(value) => setCoverer(Number(value))}
      />
      {!!coverer && (
        <ExpenseAmountPanel
          inputID={`${formID}-advance`}
          label="Reservation amount"
          currency={currency.code}
        >
          <ExpenseNumberInput
            id={`${formID}-advance`}
            inputMode="decimal"
            placeholder={(0).toFixed(currency.decimals)}
            value={coverAmount}
            onChange={(e) => setCoverAmount(e.target.value)}
          />
        </ExpenseAmountPanel>
      )}
      <p className="text-sm text-muted-foreground">
        This reservation is part of the expense total. It stays a plan until the
        payment is confirmed.
      </p>
    </>
  );
}
