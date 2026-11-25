"use client";

import { rowTitle } from "@/components/features/expenses/card-row";
import { ExpenseMoneyRow } from "@/components/features/expenses/expense-layout";

import type { Dispatch, RefObject, SetStateAction } from "react";
import { ExpensePriceField } from "@/components/features/expenses/expense-fields";
import { Label } from "@/components/ui/label";
import { expenseName, type Currency, type ExpensePerson } from "@/lib/expenses";

export function CustomSharesStep({
  formID,
  selectedPeople,
  meta,
  exact,
  setExact,
  setEditedShares,
  readShare,
  firstClickSelectsRef,
  change,
}: {
  formID: string;
  selectedPeople: ExpensePerson[];
  meta: Currency;
  exact: Record<number, string>;
  setExact: Dispatch<SetStateAction<Record<number, string>>>;
  setEditedShares: Dispatch<SetStateAction<number[]>>;
  readShare: (id: number) => { minor: bigint; problem: string };
  firstClickSelectsRef: RefObject<boolean>;
  change: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-[16px] border bg-card">
      {selectedPeople.map((person) => {
        const shareID = `${formID}-share-${person.user_id}`;
        const shareProblem = readShare(person.user_id).problem;
        return (
          <ExpenseMoneyRow
            key={person.user_id}
            className="px-3.5 py-1.5 last:border-b-0 sm:px-4 [&_[data-slot=input]:not(:focus):not([aria-invalid=true])]:border-transparent [&_[data-slot=input]]:font-semibold"
          >
            <Label htmlFor={shareID} className={rowTitle}>
              {expenseName(person)}
            </Label>
            <ExpensePriceField
              currency={meta}
              id={shareID}
              aria-label={`Share for ${expenseName(person)}`}
              aria-invalid={shareProblem ? true : undefined}
              aria-describedby={shareProblem ? `${shareID}-error` : undefined}
              value={exact[person.user_id] ?? ""}
              onFocus={(e) => {
                e.target.select();
                firstClickSelectsRef.current = true;
              }}
              onClick={(e) => {
                if (firstClickSelectsRef.current) {
                  const input = e.currentTarget;
                  // Browsers collapse a clicked selection after this event.
                  requestAnimationFrame(() => input.select());
                }
                firstClickSelectsRef.current = false;
              }}
              onChange={(e) => {
                setExact((v) => ({
                  ...v,
                  [person.user_id]: e.target.value,
                }));
                setEditedShares((ids) =>
                  ids.includes(person.user_id) ? ids : [...ids, person.user_id],
                );
                change();
              }}
            />
            {shareProblem && (
              <p
                id={`${shareID}-error`}
                role="alert"
                className="col-span-full text-left! text-sm text-destructive"
              >
                {shareProblem}
              </p>
            )}
          </ExpenseMoneyRow>
        );
      })}
    </div>
  );
}
