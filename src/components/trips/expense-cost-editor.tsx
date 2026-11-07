"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ApiError, useApi } from "@/lib/api";
import { Temporal } from "@js-temporal/polyfill";
import { ChevronRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExpensePriceField } from "./expense-fields";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  expenseMoney,
  equalShares,
  moneyInput,
  parseMoney,
  maxMinor,
} from "@/lib/money";
import {
  expenseName,
  type CostPreview,
  type Currency,
  type Expense,
  type ExpenseInput,
  type ExpensePerson,
  type Share,
} from "@/lib/expenses";
import { participantInitials } from "@/lib/memberships";
import { TripDialog } from "./trip-dialog";
import { ExpenseSelect } from "./expense-forms";
import { TripError } from "./trip-states";

export function ExpenseCostEditor({
  activity,
  tripID,
  initial,
  people,
  currencies,
  zone,
  pending = false,
  error,
  onSave,
  onBack,
  onDirty,
  onReload,
  finalFocus,
}: {
  activity: { id?: number; title: string };
  tripID: number;
  initial?: Expense;
  people: ExpensePerson[];
  currencies: Currency[];
  zone: string;
  pending?: boolean;
  error?: Error | null;
  onSave: (input: ExpenseInput) => Promise<void>;
  onBack: () => void;
  onDirty?: () => void;
  onReload?: () => Promise<void>;
  finalFocus?: () => HTMLElement | null;
}) {
  const formID = useId();
  const read = useApi();
  const [review, setReview] = useState<CostPreview | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const busy = pending || reviewing;
  const [step, setStep] = useState<
    "cost" | "custom" | "members" | "coverer" | "review"
  >("cost");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? "PHP");
  const meta = currencies.find((c) => c.code === currency) ?? {
    code: currency,
    decimals: 2,
  };
  const [basis, setBasis] = useState(initial?.amount_basis ?? "group");
  const [amount, setAmount] = useState(
    initial
      ? moneyInput(
          (basis === "per_person"
            ? BigInt(initial.amount_minor) / BigInt(initial.shares.length)
            : BigInt(initial.amount_minor)
          ).toString(),
          meta.decimals,
        )
      : "",
  );
  const [selected, setSelected] = useState(
    initial?.shares.map((s) => s.user_id) ?? people.map((p) => p.user_id),
  );
  const [mode, setMode] = useState(initial?.split_mode ?? "equal");
  const [exact, setExact] = useState<Record<number, string>>(
    Object.fromEntries(
      initial?.shares.map((s) => [
        s.user_id,
        moneyInput(s.amount_minor, meta.decimals),
      ]) ?? [],
    ),
  );
  const [coverer, setCoverer] = useState(initial?.planned_coverer_user_id ?? 0);
  const [coverAmount, setCoverAmount] = useState(
    initial?.planned_cover_amount_minor
      ? moneyInput(initial.planned_cover_amount_minor, meta.decimals)
      : "",
  );
  const [date] = useState(
    () =>
      initial?.incurred_on ??
      Temporal.Now.zonedDateTimeISO(zone).toPlainDate().toString(),
  );
  const [validation, setValidation] = useState<Error | null>(null);
  const [dirty, setDirty] = useState(false);
  // What the custom step restores on Back, and which rows were edited on it.
  const [customEntry, setCustomEntry] = useState<Record<number, string>>({});
  const [editedShares, setEditedShares] = useState<number[]>([]);
  const feedback = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const firstClickSelects = useRef(false);
  useEffect(() => {
    (
      formRef.current?.querySelector<HTMLElement>("input,button,[tabindex]") ??
      formRef.current
    )?.focus();
  }, [step]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const money = (value: string | bigint) => expenseMoney(String(value), meta);
  function change() {
    setDirty(true);
    setReview(null);
    setValidation(null);
    onDirty?.();
  }
  function fail(cause: Error) {
    setValidation(cause);
    requestAnimationFrame(() => feedback.current?.focus());
  }
  // TripError only shows ApiError text; these messages are written for the user.
  const invalid = (message: string) => fail(new ApiError(422, message));
  function back() {
    if (busy) return;
    if (step === "custom") {
      if (
        selected.some((id) => (exact[id] ?? "") !== (customEntry[id] ?? "")) &&
        !window.confirm("Discard the amounts you entered?")
      )
        return;
      setExact(customEntry);
      setValidation(null);
      setStep("cost");
      return;
    }
    if (step !== "cost") {
      setStep("cost");
      return;
    }
    if (dirty && !window.confirm("Discard this expense draft?")) return;
    onBack();
  }
  const selectedPeople = people.filter((p) => selected.includes(p.user_id));
  // A blank or unreadable share counts as nothing, so it can't wipe the running total.
  function readShare(id: number) {
    try {
      const minor = parseMoney(exact[id]?.trim() || "0", meta.decimals);
      return { minor: BigInt(minor), problem: "" };
    } catch (cause) {
      return { minor: 0n, problem: (cause as Error).message };
    }
  }
  const assigned = selected.reduce((n, id) => n + readShare(id).minor, 0n);
  let total = "0",
    shares: Share[] = [],
    problem = "";
  function checkCustomShares() {
    for (const id of selected) {
      const name = expenseName(people.find((p) => p.user_id === id));
      if (!exact[id]?.trim()) throw new Error(`Add an amount for ${name}.`);
      const share = readShare(id);
      if (share.problem) throw new Error(`${name}: ${share.problem}`);
    }
    const short = BigInt(total) - assigned;
    if (short > 0n) throw new Error(`${money(short)} is still left to assign.`);
    if (short < 0n)
      throw new Error(`Custom shares are ${money(-short)} over the total.`);
  }
  try {
    total = parseMoney(amount, meta.decimals);
    if (BigInt(total) <= 0n) throw new Error("Enter a positive price.");
    if (!selected.length) throw new Error("Include at least one member.");
    if (basis === "per_person") {
      total = (BigInt(total) * BigInt(selected.length)).toString();
      if (BigInt(total) > maxMinor) throw new Error("This total is too large.");
    }
    if (mode === "equal") shares = equalShares(total, selected);
    else {
      checkCustomShares();
      shares = selected.map((user_id) => ({
        user_id,
        amount_minor: readShare(user_id).minor.toString(),
      }));
    }
  } catch (cause) {
    problem = (cause as Error).message;
  }
  const unassigned = BigInt(total) - assigned;
  // Rows nobody has edited yet take whatever the edited rows leave over.
  const untouched = selectedPeople
    .map((p) => p.user_id)
    .filter((id) => !editedShares.includes(id));
  const remaining = untouched.reduce(
    (n, id) => n + readShare(id).minor,
    unassigned,
  );
  const canBalance =
    unassigned !== 0n &&
    editedShares.length > 0 &&
    editedShares.every((id) => exact[id]?.trim() && !readShare(id).problem) &&
    untouched.length > 0 &&
    remaining > 0n;
  const evenInputs = (amountMinor: string, ids: number[]) =>
    Object.fromEntries(
      equalShares(amountMinor, ids).map((s) => [
        s.user_id,
        moneyInput(s.amount_minor, meta.decimals),
      ]),
    );
  function openCustomSplit() {
    if (!selected.length || BigInt(total) <= 0n || BigInt(total) > maxMinor) {
      invalid("Enter a valid price and include at least one member first.");
      return;
    }
    const entry = mode === "equal" ? evenInputs(total, selected) : exact;
    setExact(entry);
    setCustomEntry(entry);
    setEditedShares([]);
    setValidation(null);
    setStep("custom");
  }
  function balanceShares() {
    setExact((v) => ({ ...v, ...evenInputs(remaining.toString(), untouched) }));
    change();
    // This button is about to disappear; don't drop keyboard focus with it.
    submitRef.current?.focus();
  }
  function resetShares() {
    if (
      editedShares.length &&
      !window.confirm("Replace the amounts you entered with an even split?")
    )
      return;
    setExact(evenInputs(total, selected));
    setEditedShares([]);
    change();
  }
  async function submit() {
    if (busy) return;
    let input: ExpenseInput;
    try {
      if (step === "members") {
        if (!selected.length) throw new Error("Include at least one member.");
        setStep("cost");
        return;
      }
      if (step === "custom") {
        checkCustomShares();
        if (basis === "per_person") {
          setBasis("group");
          setAmount(moneyInput(total, meta.decimals));
        }
        setMode("exact");
        change();
        setStep("cost");
        return;
      }
      if (step === "coverer") {
        if (
          coverer &&
          (BigInt(parseMoney(coverAmount, meta.decimals)) <= 0n ||
            BigInt(parseMoney(coverAmount, meta.decimals)) > BigInt(total))
        )
          throw new Error(
            "The planned reservation must be within the expense total.",
          );
        change();
        setStep("cost");
        return;
      }
      if (problem) throw new Error(problem);
      if (
        coverer &&
        (BigInt(parseMoney(coverAmount, meta.decimals)) <= 0n ||
          BigInt(parseMoney(coverAmount, meta.decimals)) > BigInt(total))
      )
        throw new Error("Check the planned reservation amount.");
      input = {
        activity_id: activity.id,
        description: description.trim(),
        currency,
        amount_minor: total,
        amount_basis: basis,
        incurred_on: date,
        payer_user_id: 0,
        split_mode: mode,
        shares:
          mode === "equal" ? selected.map((user_id) => ({ user_id })) : shares,
        planned_coverer_user_id: coverer,
        planned_cover_amount_minor: coverer
          ? parseMoney(coverAmount, meta.decimals)
          : "",
        ...(initial?.id && initial.id > 0 ? { version: initial.version } : {}),
      };
    } catch (cause) {
      invalid((cause as Error).message);
      return;
    }
    try {
      if (initial && initial.id > 0 && step !== "review") {
        setReviewing(true);
        const result = await read<CostPreview>(
          `/api/v1/trips/${tripID}/expenses/${initial.id}/cost-preview`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          },
        );
        if (!result)
          throw new ApiError(500, "Unable to preview changes. Please retry.");
        if (result.before.payments.length) {
          setReview(result);
          setStep("review");
          return;
        }
      }
      await onSave(input);
    } catch (cause) {
      fail(cause as Error);
    } finally {
      setReviewing(false);
    }
  }
  let plannedLabel = "amount to choose";
  try {
    if (coverAmount)
      plannedLabel = money(parseMoney(coverAmount, meta.decimals));
  } catch {
    /* Keep an invalid draft editable. */
  }
  const failure = validation ?? error;
  const title =
    step === "review"
      ? "Review expense changes"
      : step === "custom"
        ? "Custom split"
        : step === "members"
          ? "Who is included?"
          : step === "coverer"
            ? "Who will pay first?"
            : initial
              ? "Edit expense"
              : "Add expense";
  const subtitle =
    step === "cost"
      ? activity.title
      : `${description || "Expense"} · ${money(total)} ${basis === "per_person" ? "total" : "group price"}`;
  const footerLabel =
    step === "custom"
      ? "Use this split"
      : step === "members"
        ? "Use these members"
        : step === "coverer"
          ? "Use this plan"
          : "Save expense";
  return (
    <TripDialog
      open
      finalFocus={finalFocus}
      focusTitleOnChange
      presentation="detail"
      className="activity-details-dialog expense-flow-dialog"
      backLabel={step === "cost" ? "Back to activity" : "Back to expense"}
      backdropClassName="bg-black/60"
      title={title}
      description={subtitle}
      titleAction={
        step === "custom" && (
          // Outside the form's disabled fieldset, so it blocks itself while busy.
          <Button
            type="button"
            variant="link"
            className="figma-summary-action px-0"
            disabled={busy}
            onClick={resetShares}
          >
            Reset to even
          </Button>
        )
      }
      headerAction={
        step === "cost" && (
          // Outside the form's disabled fieldset, so it blocks itself while busy.
          <Button
            type="button"
            variant="ghost"
            className="trip-people"
            disabled={busy}
            aria-label={`Who is included? ${
              selected.length === 1
                ? "1 member"
                : selected.length === people.length
                  ? `All ${selected.length} members`
                  : `${selected.length} members`
            }`}
            onClick={() => setStep("members")}
          >
            {selectedPeople.length ? (
              <span aria-hidden="true" className="trip-people-avatars">
                {selectedPeople.slice(0, 3).map((person) => (
                  <span key={person.user_id}>
                    {participantInitials(person)}
                  </span>
                ))}
                {selectedPeople.length > 3 && (
                  <span>+{selectedPeople.length - 3}</span>
                )}
              </span>
            ) : (
              <>
                <Users aria-hidden="true" />
                Members
              </>
            )}
          </Button>
        )
      }
      busy={busy}
      disablePointerDismissal
      onOpenChange={(open) => {
        if (!open) back();
      }}
      footer={
        <>
          {step === "custom" && (
            <div
              className="expense-split-status"
              data-balanced={unassigned === 0n}
            >
              <div aria-live="polite">
                <p className="figma-summary-value">
                  {unassigned === 0n
                    ? "Matches the total"
                    : unassigned > 0n
                      ? `${money(unassigned)} left to assign`
                      : `${money(-unassigned)} over`}
                </p>
                <p>
                  {money(assigned)} of {money(total)} assigned
                </p>
              </div>
              {canBalance && (
                <Button
                  type="button"
                  variant="link"
                  disabled={busy}
                  onClick={balanceShares}
                >
                  {untouched.length === 1
                    ? `Give the remaining ${money(remaining)} to the other person`
                    : `Split the remaining ${money(remaining)} between the other ${untouched.length}`}
                </Button>
              )}
            </div>
          )}
          <Button
            ref={submitRef}
            className="w-full"
            type="submit"
            form={formID}
            disabled={busy}
          >
            {reviewing ? "Reviewing…" : pending ? "Saving…" : footerLabel}
          </Button>
        </>
      }
    >
      <form
        tabIndex={-1}
        ref={formRef}
        id={formID}
        className="figma-expense-form"
        onChange={change}
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          return submit();
        }}
      >
        <fieldset disabled={busy} className="space-y-6 min-w-0">
          {step === "cost" && (
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
                  Custom amounts keep the same group total and let you adjust
                  each person’s share.
                </p>
              )}
              <div className="figma-money-summary" aria-live="polite">
                <p className="figma-summary-value">
                  {amount && !problem
                    ? mode === "equal" &&
                      shares.every(
                        (s) => s.amount_minor === shares[0]?.amount_minor,
                      )
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
          )}
          {step === "review" && review && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Recorded payments stay unchanged. Review the updated balances
                before saving.
              </p>
              <div className="figma-money-summary">
                <p>
                  Expense total: {money(review.before.expense.amount_minor)} →{" "}
                  {money(review.after.expense.amount_minor)}
                </p>
                <p>
                  Paid to business: {money(review.before.business_paid_minor)} →{" "}
                  {money(review.after.business_paid_minor)}
                </p>
              </div>
              <div className="divide-y">
                {review.after.members.map((member) => {
                  const before = review.before.members.find(
                    (m) => m.user_id === member.user_id,
                  );
                  return (
                    <div key={member.user_id} className="py-3 space-y-2">
                      <strong>
                        {expenseName(
                          people.find((p) => p.user_id === member.user_id),
                        )}
                      </strong>
                      <p className="text-sm">
                        Still to pay: {money(before?.remaining_minor ?? "0")} →{" "}
                        {money(member.remaining_minor)}
                      </p>
                      {BigInt(member.credit_minor) > 0n && (
                        <p className="text-sm text-primary">
                          Credit requiring correction:{" "}
                          {money(member.credit_minor)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {step === "members" && (
            <div className="divide-y">
              {people.map((person) => (
                <label
                  key={person.user_id}
                  className="flex min-h-16 items-center gap-3 py-3"
                >
                  <input
                    type="checkbox"
                    className="size-5 accent-primary"
                    checked={selected.includes(person.user_id)}
                    onChange={(e) => {
                      setSelected((ids) =>
                        e.target.checked
                          ? [...ids, person.user_id]
                          : ids.filter((id) => id !== person.user_id),
                      );
                      change();
                    }}
                  />
                  <span className="break-words">{expenseName(person)}</span>
                </label>
              ))}
            </div>
          )}
          {step === "custom" && (
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
                      aria-describedby={
                        shareProblem ? `${shareID}-error` : undefined
                      }
                      inputMode="decimal"
                      value={exact[person.user_id] ?? ""}
                      onFocus={(e) => {
                        e.target.select();
                        firstClickSelects.current = true;
                      }}
                      onClick={(e) => {
                        if (firstClickSelects.current) {
                          const input = e.currentTarget;
                          // Browsers collapse a clicked selection after this event.
                          requestAnimationFrame(() => input.select());
                        }
                        firstClickSelects.current = false;
                      }}
                      onChange={(e) => {
                        setExact((v) => ({
                          ...v,
                          [person.user_id]: e.target.value,
                        }));
                        setEditedShares((ids) =>
                          ids.includes(person.user_id)
                            ? ids
                            : [...ids, person.user_id],
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
          )}
          {step === "coverer" && (
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
                This reservation is part of the expense total. It stays a plan
                until the payment is confirmed.
              </p>
            </>
          )}
          {(validation || error) && (
            <div ref={feedback} tabIndex={-1}>
              <TripError error={validation ?? error!} />
              {onReload &&
                failure instanceof ApiError &&
                failure.status === 409 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      if (
                        !window.confirm(
                          "Discard this expense draft and reload the latest expense?",
                        )
                      )
                        return;
                      try {
                        await onReload();
                      } catch (cause) {
                        setValidation(cause as Error);
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
