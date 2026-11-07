"use client";

import type { Dispatch, SetStateAction } from "react";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { expenseName, type Currency, type ExpensePerson } from "@/lib/expenses";
import { moneyInput } from "@/lib/money";

export function SharingSection({
  sharePeople,
  selected,
  setSelected,
  mode,
  setMode,
  basis,
  setBasis,
  amount,
  setAmount,
  exact,
  setExact,
  preview,
  previewError,
  total,
  meta,
  money,
  setValidation,
  changed,
}: {
  sharePeople: ExpensePerson[];
  selected: number[];
  setSelected: Dispatch<SetStateAction<number[]>>;
  mode: "equal" | "exact";
  setMode: (mode: "equal" | "exact") => void;
  basis: "group" | "per_person";
  setBasis: (basis: "group" | "per_person") => void;
  amount: string;
  setAmount: (amount: string) => void;
  exact: Record<number, string>;
  setExact: Dispatch<SetStateAction<Record<number, string>>>;
  preview: { user_id: number; amount_minor: string }[];
  previewError: string;
  total: string;
  meta: Currency;
  money: (value: string) => string;
  setValidation: (error: Error | null) => void;
  changed: () => void;
}) {
  return (
    <section className="expense-sharing" aria-label="Travelers and split">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">Who’s sharing?</h3>
        <span className="text-sm text-muted-foreground">
          {selected.length} {selected.length === 1 ? "traveler" : "travelers"}
        </span>
      </div>
      <fieldset className="expense-choice" aria-label="Split costs">
        <legend className="sr-only">Split costs</legend>
        {[
          { value: "equal", label: "Split evenly" },
          { value: "exact", label: "Custom amounts" },
        ].map((option) => (
          <label key={option.value}>
            <input
              id={`cost-mode-${option.value}`}
              type="radio"
              name="split-mode"
              checked={mode === option.value}
              onChange={() => {
                if (option.value === "exact") {
                  if (previewError) {
                    setValidation(new ApiError(422, previewError));
                    return;
                  }
                  if (basis === "per_person") {
                    setBasis("group");
                    setAmount(moneyInput(total, meta.decimals));
                  }
                  setExact(
                    Object.fromEntries(
                      preview.map((share) => [
                        share.user_id,
                        moneyInput(share.amount_minor, meta.decimals),
                      ]),
                    ),
                  );
                }
                setMode(option.value as typeof mode);
                changed();
              }}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
      <div className="expense-travelers">
        {sharePeople.map((person) => (
          <div
            key={person.user_id}
            className="expense-traveler"
            data-selected={selected.includes(person.user_id)}
          >
            <label className="expense-traveler-name">
              <input
                type="checkbox"
                className="size-4 shrink-0 accent-primary"
                checked={selected.includes(person.user_id)}
                onChange={(e) =>
                  setSelected((ids) =>
                    e.target.checked
                      ? [...ids, person.user_id]
                      : ids.filter((id) => id !== person.user_id),
                  )
                }
              />
              <span className="min-w-0 break-words">{expenseName(person)}</span>
            </label>
            {selected.includes(person.user_id) &&
              (mode === "exact" ? (
                <Input
                  className="expense-custom-share"
                  aria-label={`Share for ${expenseName(person)}`}
                  inputMode="decimal"
                  value={exact[person.user_id] ?? ""}
                  onChange={(e) =>
                    setExact((values) => ({
                      ...values,
                      [person.user_id]: e.target.value,
                    }))
                  }
                />
              ) : (
                <span className="expense-traveler-share">
                  {amount && !previewError
                    ? money(
                        preview.find(
                          (share) => share.user_id === person.user_id,
                        )?.amount_minor ?? "0",
                      )
                    : "—"}
                </span>
              ))}
          </div>
        ))}
      </div>
      <p className="expense-split-preview" aria-live="polite">
        {amount
          ? previewError ||
            `${money(total)} total${mode === "equal" && selected.length && preview[0] && BigInt(total) % BigInt(selected.length) === 0n ? ` · ${money(preview[0].amount_minor)} each` : ""}`
          : "Add an amount to see everyone’s share."}
      </p>
    </section>
  );
}
