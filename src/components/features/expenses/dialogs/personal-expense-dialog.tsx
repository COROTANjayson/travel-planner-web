"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Temporal } from "@js-temporal/polyfill";
import { ActivityPicker } from "@/components/features/expenses/activity-picker";
import { ExpenseAmountPanel } from "@/components/features/expenses/expense-amount-panel";
import { ExpensePriceField } from "@/components/features/expenses/expense-fields";
import { fieldRequired } from "@/components/shared/field-required";
import { TripDialog } from "@/components/shared/trip-dialog";
import { expenseModalProps } from "@/components/shared/trip-dialog-variants";
import { TripError } from "@/components/shared/trip-states";
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
import { ApiError } from "@/lib/api";
import type { Currency } from "@/lib/expenses";
import type { Activity } from "@/lib/itinerary";
import { moneyInput, parseMoney } from "@/lib/money";
import type {
  PersonalExpense,
  PersonalExpenseInput,
} from "@/lib/personal-expenses";

/** Add or edit spending only its creator can see. */
export function PersonalExpenseDialog({
  record,
  activities,
  activitiesError,
  currencies,
  zone,
  pending,
  onSave,
  onReload,
  onClose,
  finalFocus,
}: {
  /** The expense being edited; reloading it after a conflict keeps what was typed. */
  record?: PersonalExpense;
  activities: Activity[];
  activitiesError: boolean;
  currencies: Currency[];
  zone: string;
  pending: boolean;
  onSave: (input: PersonalExpenseInput) => Promise<void>;
  onReload?: () => Promise<void>;
  onClose: () => void;
  finalFocus: () => HTMLElement | null;
}) {
  const formID = useId();
  const decimals = (code: string) =>
    currencies.find((c) => c.code === code)?.decimals ?? 2;
  const [description, setDescription] = useState(record?.description ?? "");
  const [currency, setCurrency] = useState(record?.currency ?? "PHP");
  const [amount, setAmount] = useState(
    record ? moneyInput(record.amount_minor, decimals(record.currency)) : "",
  );
  const [activity, setActivity] = useState(record?.activity_id ?? 0);
  const [date, setDate] = useState(
    () =>
      record?.incurred_on ??
      Temporal.Now.zonedDateTimeISO(zone).toPlainDate().toString(),
  );
  const [failure, setFailure] = useState<Error | null>(null);
  const [reloaded, setReloaded] = useState(false);
  const feedback = useRef<HTMLDivElement>(null);
  const name = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  useEffect(() => {
    if (failure) feedback.current?.focus();
  }, [failure]);
  const meta = { code: currency, decimals: decimals(currency) };
  let problem = "";
  try {
    if (amount.trim() && BigInt(parseMoney(amount, meta.decimals)) <= 0n)
      problem = "Enter a positive amount.";
  } catch (cause) {
    problem = (cause as Error).message;
  }
  async function submit() {
    if (pending || busy.current) return;
    // TripError only shows ApiError text; these messages are written for the user.
    const missing = !description.trim()
      ? "Name this expense."
      : !amount.trim()
        ? "Enter an amount."
        : problem || (!date ? "Choose a date." : "");
    if (missing) return setFailure(new ApiError(422, missing));
    busy.current = true;
    setFailure(null);
    setReloaded(false);
    try {
      await onSave({
        description,
        currency,
        amount_minor: parseMoney(amount, meta.decimals),
        incurred_on: date,
        // An activity removed meanwhile can't be sent again; its title is kept.
        ...(activity &&
        (activitiesError || activities.some((a) => a.id === activity))
          ? { activity_id: activity }
          : {}),
      });
    } catch (cause) {
      setFailure(cause as Error);
    } finally {
      busy.current = false;
    }
  }
  return (
    <TripDialog
      open
      {...expenseModalProps}
      focusTitleOnChange={false}
      initialFocus={name}
      finalFocus={finalFocus}
      title={record ? "Edit personal expense" : "Add personal expense"}
      busy={pending}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      footer={
        <div className="flex gap-3 max-sm:[&>*]:flex-1 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button type="submit" form={formID} disabled={pending}>
            {pending ? "Saving…" : "Save expense"}
          </Button>
        </div>
      }
    >
      <form
        id={formID}
        noValidate
        onChange={() => setFailure(null)}
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          return submit();
        }}
      >
        <fieldset disabled={pending} className="min-w-0 space-y-5">
          <div className="space-y-2">
            <Label htmlFor={`${formID}-name`} className={fieldRequired}>
              Expense name
            </Label>
            <Input
              id={`${formID}-name`}
              ref={name}
              required
              maxLength={200}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <ExpenseAmountPanel
            inputID={`${formID}-amount`}
            required
            label="Amount"
            currency={
              <Select
                value={currency}
                onValueChange={(value) => {
                  if (!value) return;
                  setCurrency(value);
                  setFailure(null);
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
            footer={
              <p
                aria-live="polite"
                className={problem ? "text-[#ffd5ca]" : undefined}
              >
                {problem || "Only you · not split"}
              </p>
            }
          >
            <ExpensePriceField
              id={`${formID}-amount`}
              required
              currency={meta}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </ExpenseAmountPanel>
          <ActivityPicker
            id={`${formID}-activity`}
            activities={activities}
            zone={zone}
            value={activity}
            disabled={pending || activitiesError}
            placeholder={
              record?.activity_name && !activity
                ? `${record.activity_name} (removed)`
                : undefined
            }
            onChange={(value) => {
              setActivity(value);
              setFailure(null);
            }}
          />
          {activitiesError && (
            <p className="text-sm text-muted-foreground">
              Activities couldn’t load, so this expense keeps its current
              activity.
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor={`${formID}-date`} className={fieldRequired}>
              Date
            </Label>
            <Input
              id={`${formID}-date`}
              required
              type="date"
              min="0001-01-01"
              max="9999-12-31"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <p className="text-[13px] leading-5 text-muted-foreground">
            Only you can see personal expenses.
          </p>
          {reloaded && (
            <p role="status" className="text-sm leading-5">
              This expense changed elsewhere. What you typed is kept; saving
              replaces the newer version.
            </p>
          )}
          {failure && (
            <div ref={feedback} tabIndex={-1} className="space-y-3">
              <TripError error={failure} />
              {onReload &&
                failure instanceof ApiError &&
                failure.status === 409 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await onReload();
                        setFailure(null);
                        setReloaded(true);
                      } catch (cause) {
                        setFailure(cause as Error);
                      }
                    }}
                  >
                    Reload latest expense
                  </Button>
                )}
            </div>
          )}
        </fieldset>
      </form>
    </TripDialog>
  );
}
