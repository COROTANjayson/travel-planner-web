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
    <div className="figma-custom-shares [&>div]:grid [&>div]:items-center [&>div]:gap-4 [display:grid] [gap:16px] [&>div]:[grid-template-columns:minmax(0,_1fr)_minmax(0,_158px)] [&>div]:[row-gap:4px] [&_label]:[font-size:16px] [&_label]:[font-weight:400] [&_label]:[line-height:1.35] [&_label]:[overflow-wrap:anywhere] [&_input]:[padding-inline:12px] [&_input]:[text-align:right] [&_input]:[font-variant-numeric:tabular-nums] [&_label]:[color:var(--foreground)] max-[359px]:[&_>_div]:[grid-template-columns:minmax(0,_1fr)_minmax(0,_42%)] [&_.reference-field_>_span]:[justify-content:flex-end] [&_.reference-field_>_span]:[padding-inline:12px] [&_.reference-field_>_span]:[font-variant-numeric:tabular-nums]">
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
                className="figma-share-error [grid-column:1_/_-1] text-sm text-destructive"
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
