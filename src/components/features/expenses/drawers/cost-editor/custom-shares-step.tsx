"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";
import { ExpensePriceField } from "@/components/features/expenses/expense-fields";
import { Label } from "@/components/ui/label";
import { expenseName, type ExpensePerson } from "@/lib/expenses";

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
  meta: Parameters<typeof ExpensePriceField>[0]["currency"];
  exact: Record<number, string>;
  setExact: Dispatch<SetStateAction<Record<number, string>>>;
  setEditedShares: Dispatch<SetStateAction<number[]>>;
  readShare: (id: number) => { minor: bigint; problem: string };
  firstClickSelectsRef: RefObject<boolean>;
  change: () => void;
}) {
  return (
    <div className="figma-custom-shares">
      {selectedPeople.map((person) => {
        const shareID = `${formID}-share-${person.user_id}`;
        const shareProblem = readShare(person.user_id).problem;
        return (
          <div key={person.user_id}>
            <Label htmlFor={shareID}>{expenseName(person)}</Label>
            <ExpensePriceField
              currency={meta}
              id={shareID}
              aria-label={`Share for ${expenseName(person)}`}
              aria-invalid={shareProblem ? true : undefined}
              aria-describedby={shareProblem ? `${shareID}-error` : undefined}
              inputMode="decimal"
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
                className="figma-share-error text-sm text-destructive"
              >
                {shareProblem}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
