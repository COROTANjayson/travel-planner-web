"use client";

import type { ComponentProps } from "react";
import { ExpenseAmountPanel } from "@/components/features/expenses/expense-amount-panel";
import { fieldRequired } from "@/components/shared/field-required";
import { CaretRightIcon } from "@phosphor-icons/react";
import { ExpensePriceField } from "@/components/features/expenses/expense-fields";
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

// Figma "Detail row": a setting with a sensible default that opens another step.
function DetailRow({
  label,
  labelID,
  value,
  ...props
}: Omit<ComponentProps<"button">, "children" | "value"> & {
  label: string;
  labelID: string;
  value: string;
}) {
  return (
    <button
      type="button"
      className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-[14px] border border-input bg-card p-3 text-left outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-50"
      {...props}
    >
      <span id={labelID} className="shrink-0">
        {label}
      </span>
      <span className="min-w-0 flex-1 text-right text-sm text-muted-foreground [overflow-wrap:anywhere]">
        {value}
      </span>
      <CaretRightIcon
        aria-hidden="true"
        className="size-[18px] shrink-0 text-muted-foreground"
      />
    </button>
  );
}

export function CostStep({
  formID,
  description,
  setDescription,
  selectName,
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
  openSplit,
  setStep,
}: {
  formID: string;
  description: string;
  setDescription: (description: string) => void;
  /** The name is still the pre-fill: focusing selects it so typing replaces it. */
  selectName?: boolean;
  basis: "group" | "per_person";
  setBasis: (basis: "group" | "per_person") => void;
  mode: "equal" | "exact";
  setMode: (mode: "equal" | "exact") => void;
  amount: string;
  setAmount: (amount: string) => void;
  currency: string;
  setCurrency: (currency: string) => void;
  currencies: Currency[];
  meta: Currency;
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
  openSplit: () => void;
  setStep: (step: "coverer") => void;
}) {
  const count = `${selected.length} ${selected.length === 1 ? "person" : "people"}`;
  const even = shares.every((s) => s.amount_minor === shares[0]?.amount_minor);
  const share = !amount.trim()
    ? "Enter a price to see each share"
    : problem ||
      (mode === "exact" || !even
        ? `${money(total)} total · custom split · ${count}`
        : basis === "per_person"
          ? `${money(total)} total · ${count}`
          : `${money(shares[0]?.amount_minor ?? "0")} each · ${count}`);
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
          onFocus={selectName ? (e) => e.target.select() : undefined}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <ExpenseAmountPanel
        inputID={`${formID}-price`}
        required
        label={basis === "group" ? "Group price" : "Price per person"}
        currency={
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
        }
        toggle={
          <fieldset className="flex rounded-full bg-[var(--ocean-raised)] p-[3px]">
            <legend className="sr-only">How is the price given?</legend>
            {[
              { value: "group", label: "Group total" },
              { value: "per_person", label: "Per person" },
            ].map((option) => (
              <label key={option.value} className="relative">
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
                <span className="grid h-[38px] cursor-pointer place-items-center rounded-full px-3.5 text-xs leading-5 font-medium peer-checked:bg-[var(--aqua)] peer-checked:font-semibold peer-checked:text-[var(--ocean)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--aqua)]">
                  {option.label}
                </span>
              </label>
            ))}
          </fieldset>
        }
        footer={
          <p
            aria-live="polite"
            className={problem && amount.trim() ? "text-[#ffd5ca]" : undefined}
          >
            {share}
          </p>
        }
      >
        <ExpensePriceField
          currency={meta}
          id={`${formID}-price`}
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </ExpenseAmountPanel>
      <div className="space-y-3">
        <DetailRow
          id={`${formID}-split`}
          labelID={`${formID}-split-label`}
          aria-labelledby={`${formID}-split-label ${formID}-split`}
          label="Split"
          value={
            mode === "exact"
              ? `Custom amounts · ${count}`
              : `Evenly among ${count}`
          }
          onClick={openSplit}
        />
        <DetailRow
          id={`${formID}-coverer`}
          labelID={`${formID}-coverer-label`}
          aria-labelledby={`${formID}-coverer-label ${formID}-coverer`}
          label="Who’s paying"
          value={
            coverer
              ? `${expenseName(people.find((p) => p.user_id === coverer))} · reservation ${plannedLabel}`
              : "Decide later"
          }
          onClick={() => {
            if (!amount || problem) {
              invalid("Enter a valid price and split first.");
              return;
            }
            setStep("coverer");
          }}
        />
      </div>
    </>
  );
}
