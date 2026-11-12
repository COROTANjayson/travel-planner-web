"use client";

import { fieldRequired } from "@/components/shared/field-required";
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
        <Label htmlFor={`${formID}-name`} className={fieldRequired}>
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
        <div className="figma-price-choice flex rounded-full bg-secondary p-[3px]">
          {[
            { value: "per_person", label: "Per person" },
            { value: "group", label: "Group total" },
          ].map((option) => (
            <label key={option.value} className="relative min-w-0 flex-1">
              <input
                className="peer absolute opacity-0"
                type="radio"
                name={`${formID}-basis`}
                checked={basis === option.value}
                onChange={() => {
                  setBasis(option.value as typeof basis);
                  if (option.value === "per_person") setMode("equal");
                  change();
                }}
              />
              <span className="grid min-h-12 cursor-pointer place-items-center rounded-full p-2 peer-checked:bg-primary peer-checked:font-semibold peer-checked:text-primary-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-[3px] peer-focus-visible:outline-ring">
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="expense-price-split [display:grid] [grid-template-columns:repeat(auto-fit,_minmax(min(100%,_12rem),_1fr))] [gap:1.5rem_0.75rem]">
        <div className="min-w-0 space-y-2">
          <Label htmlFor={`${formID}-price`} className={fieldRequired}>
            {basis === "group" ? "Group price" : "Price per person"}
          </Label>
          <div className="price-with-currency relative [&_.reference-field>span]:pr-24 [&_.reference-field>span]:[overflow-wrap:anywhere] [&_[data-slot='select-trigger']]:absolute [&_[data-slot='select-trigger']]:inset-[1px_1px_1px_auto] [&_[data-slot='select-trigger']]:min-h-0 [&_[data-slot='select-trigger']]:w-auto [&_[data-slot='select-trigger']]:rounded-[0_0.8125rem_0.8125rem_0] [&_[data-slot='select-trigger']]:border-0 [&_[data-slot='select-trigger']]:bg-transparent [&_[data-slot='select-trigger']]:px-4 [&_[data-slot='select-trigger']::before]:absolute [&_[data-slot='select-trigger']::before]:inset-[0.5rem_auto_0.5rem_0] [&_[data-slot='select-trigger']::before]:w-px [&_[data-slot='select-trigger']::before]:bg-border [&_[data-slot='select-trigger']::before]:content-[''] [&_[data-slot='select-trigger']:focus-visible]:outline-2 [&_[data-slot='select-trigger']:focus-visible]:-outline-offset-2 [&_[data-slot='select-trigger']:focus-visible]:outline-ring">
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
      <div
        className="figma-money-summary [&>p:not(.figma-summary-value)]:text-sm [&>p:not(.figma-summary-value)]:leading-[1.7] [display:grid] [gap:1rem] [background:var(--secondary)] [overflow-wrap:anywhere] [border:1px_solid_var(--border)] [padding:20px] [border-radius:18px] [&:has(>_.figma-summary-action)]:[display:flex] [&:has(>_.figma-summary-action)]:[flex-wrap:wrap] [&:has(>_.figma-summary-action)]:[align-items:center] [&:has(>_.figma-summary-action)_>_.figma-summary-value]:[flex-basis:100%] [&:has(>_.figma-summary-action)_>_p:not(.figma-summary-value)]:[flex:1_1_8rem]"
        aria-live="polite"
      >
        <p className="figma-summary-value [font-weight:700] [font-size:22px] [line-height:30px]">
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
            className="figma-summary-action px-0 [&[data-slot='button']]:[min-height:44px] [&[data-slot='button']]:[margin-block:-0.625rem] [&[data-slot='button']]:[margin-left:auto] [&[data-slot='button']]:[white-space:normal]"
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
          className="figma-select-button [&[data-slot='button']]:[font-size:1rem] [&[data-slot='button']]:[width:100%] [&[data-slot='button']]:[min-height:3rem] [&[data-slot='button']]:[height:auto] [&[data-slot='button']]:[justify-content:space-between] [&[data-slot='button']]:[border-radius:0.875rem] [&[data-slot='button']]:[padding:0.75rem] [&[data-slot='button']]:[white-space:normal] [&[data-slot='button']]:[text-align:left]"
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
