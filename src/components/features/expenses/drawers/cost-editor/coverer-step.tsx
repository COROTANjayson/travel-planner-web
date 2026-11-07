"use client";

import { ExpenseSelect } from "@/components/features/expenses/expense-forms";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { expenseName, type ExpensePerson } from "@/lib/expenses";

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
  currency: string;
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
        <div className="space-y-2">
          <Label htmlFor={`${formID}-advance`}>
            Reservation amount · {currency}
          </Label>
          <Input
            id={`${formID}-advance`}
            inputMode="decimal"
            value={coverAmount}
            onChange={(e) => setCoverAmount(e.target.value)}
          />
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        This reservation is part of the expense total. It stays a plan until the
        payment is confirmed.
      </p>
    </>
  );
}
