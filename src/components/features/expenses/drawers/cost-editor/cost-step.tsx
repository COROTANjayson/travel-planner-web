"use client";

import { ChevronRight } from "lucide-react";
import { ExpensePriceField } from "@/components/features/expenses/expense-fields";
import { ExpenseSelect } from "@/components/features/expenses/expense-forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  expenseName,
  type Currency,
  type ExpensePerson,
  type Share,
} from "@/lib/expenses";

export function CostStep({
  formID,
  description,
  setDescription,
  basis,
  setBasis,
  mode,
  setMode,
  amount,
  setAmount,
  currency,
  setCurrency,
  currencies,
  meta,
  problem,
  shares,
  total,
  selected,
  coverer,
  people,
  plannedLabel,
  money,
  change,
  invalid,
  openCustomSplit,
  setStep,
}: {
  formID: string;
  description: string;
  setDescription: (description: string) => void;
  basis: "group" | "per_person";
  setBasis: (basis: "group" | "per_person") => void;
  mode: "equal" | "exact";
  setMode: (mode: "equal" | "exact") => void;
  amount: string;
  setAmount: (amount: string) => void;
  currency: string;
  setCurrency: (currency: string) => void;
  currencies: Currency[];
  meta: Parameters<typeof ExpensePriceField>[0]["currency"];
  problem: string;
  shares: Share[];
  total: string;
  selected: number[];
  coverer: number;
  people: ExpensePerson[];
  plannedLabel: string;
  money: (value: string | bigint) => string;
  change: () => void;
  invalid: (message: string) => void;
  openCustomSplit: () => void;
  setStep: (step: "coverer") => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${formID}-name`} className="field-required">
          Expense name
        </Label>
        <Input
          id={`${formID}-name`}
          autoFocus
          required
          maxLength={200}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <fieldset>
        <legend className="mb-2 text-sm text-muted-foreground">
          How is the price given?
        </legend>
        <div className="figma-price-choice">
          {[
            { value: "per_person", label: "Per person" },
            { value: "group", label: "Group total" },
          ].map((option) => (
            <label key={option.value}>
              <input
                type="radio"
                name={`${formID}-basis`}
                checked={basis === option.value}
                onChange={() => {
                  setBasis(option.value as typeof basis);
                  if (option.value === "per_person") setMode("equal");
                  change();
                }}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="expense-price-split">
        <div className="min-w-0 space-y-2">
          <Label htmlFor={`${formID}-price`} className="field-required">
            {basis === "group" ? "Group price" : "Price per person"}
          </Label>
          <div className="price-with-currency">
            <ExpensePriceField
              currency={meta}
              id={`${formID}-price`}
              inputMode="decimal"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Select
              value={currency}
              onValueChange={(value) => {
                if (value) {
                  setCurrency(value);
                  change();
                }
              }}
            >
              <SelectTrigger aria-label="Currency">
                <SelectValue>{currency}</SelectValue>
              </SelectTrigger>
              <SelectContent align="end" alignItemWithTrigger={false}>
                {currencies.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <ExpenseSelect
          id={`${formID}-split`}
          label="Split"
          value={mode}
          options={[
            { value: "equal", label: "Split evenly" },
            { value: "exact", label: "Custom amounts" },
          ]}
          onChange={(value) => {
            if (value === "exact") {
              openCustomSplit();
            } else {
              setMode("equal");
              change();
            }
          }}
        />
      </div>
      {basis === "per_person" && (
        <p className="text-sm text-muted-foreground">
          Custom amounts keep the same group total and let you adjust each
          person’s share.
        </p>
      )}
      <div className="figma-money-summary" aria-live="polite">
        <p className="figma-summary-value">
          {amount && !problem
            ? mode === "equal" &&
              shares.every((s) => s.amount_minor === shares[0]?.amount_minor)
              ? `${money(shares[0]?.amount_minor ?? "0")} each`
              : money(total)
            : "Your expense estimate"}
        </p>
        <p>
          {amount
            ? problem ||
              `${selected.length === 1 ? "1 share adds" : `${selected.length} shares add`} up to ${money(total)}`
            : "Enter a price to preview the split."}
        </p>
        {mode === "exact" && (
          <Button
            type="button"
            variant="link"
            className="figma-summary-action px-0"
            onClick={openCustomSplit}
          >
            Change custom split
          </Button>
        )}
      </div>
      <div className="space-y-2">
        <Label id={`${formID}-coverer-label`}>
          Who will pay first? (optional)
        </Label>
        <Button
          id={`${formID}-coverer`}
          aria-labelledby={`${formID}-coverer-label ${formID}-coverer`}
          variant="outline"
          className="figma-select-button"
          type="button"
          onClick={() => {
            if (!amount || problem) {
              invalid("Enter a valid price and split first.");
              return;
            }
            setStep("coverer");
          }}
        >
          <span className="min-w-0 break-words">
            {coverer
              ? `${expenseName(people.find((p) => p.user_id === coverer))} · reservation ${plannedLabel}`
              : "Decide later"}
          </span>
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </>
  );
}
