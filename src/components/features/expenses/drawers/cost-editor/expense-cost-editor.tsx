"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ApiError, useApi } from "@/lib/api";
import { Temporal } from "@js-temporal/polyfill";
import { ListChecksIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  costAmountInput,
  costTotal,
  expenseMoney,
  equalShares,
  maxMinor,
  moneyInput,
  parseMoney,
  plannedCoverInvalid,
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
import { TripDialog } from "@/components/shared/trip-dialog";
import { expenseModalProps } from "@/components/shared/trip-dialog-variants";
import { TripError } from "@/components/shared/trip-states";
import {
  ActivityPicker,
  type PickerActivity,
} from "@/components/features/expenses/activity-picker";
import { CostStep } from "@/components/features/expenses/drawers/cost-editor/cost-step";
import { CovererStep } from "@/components/features/expenses/drawers/cost-editor/coverer-step";
import { CustomSharesStep } from "@/components/features/expenses/drawers/cost-editor/custom-shares-step";
import { MembersStep } from "@/components/features/expenses/drawers/cost-editor/members-step";
import { ReviewStep } from "@/components/features/expenses/drawers/cost-editor/review-step";
import { SplitStatusFooter } from "@/components/features/expenses/drawers/cost-editor/split-status-footer";

export function ExpenseCostEditor({
  activity: fixedActivity,
  activities,
  prepTask,
  tripID,
  initial,
  defaultName,
  recordsPayment,
  people,
  currencies,
  zone,
  pending = false,
  error,
  onSave,
  onBack,
  onDirty,
  onReload,
  onForbidden,
  finalFocus,
}: {
  activity: { id?: number; title: string };
  /** A new expense started outside an activity: choose one here. */
  activities?: PickerActivity[];
  /** Pre-filled (and selected) name for a new expense, e.g. the activity's first. */
  defaultName?: string;
  /** The caller records a reservation payment when saving this new expense. */
  recordsPayment: boolean;
  /** Adding from a prep task: the task (and its activity, if any) is fixed. */
  prepTask?: { id: number; title: string };
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
  /** The preview found the role changed; saving reports this itself. */
  onForbidden?: (error: Error) => void;
  finalFocus?: () => HTMLElement | null;
}) {
  const formID = useId();
  const read = useApi();
  const [picked, setPicked] = useState(0);
  const picking = !!activities && !initial;
  const activity = picking
    ? { id: picked || undefined, title: "" }
    : fixedActivity;
  const [review, setReview] = useState<CostPreview | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const busy = pending || reviewing;
  const [step, setStep] = useState<
    "cost" | "custom" | "members" | "coverer" | "review"
  >("cost");
  const [description, setDescription] = useState(
    initial?.description ?? defaultName ?? "",
  );
  const [currency, setCurrency] = useState(initial?.currency ?? "PHP");
  const meta = currencies.find((c) => c.code === currency) ?? {
    code: currency,
    decimals: 2,
  };
  const [basis, setBasis] = useState(initial?.amount_basis ?? "group");
  const [amount, setAmount] = useState(
    initial
      ? costAmountInput(initial, basis === "per_person", meta.decimals)
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
  // What the custom step restores on Back, and which rows were edited on it.
  const [customEntry, setCustomEntry] = useState<Record<number, string>>({});
  const [editedShares, setEditedShares] = useState<number[]>([]);
  const feedback = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const firstClickSelects = useRef(false);
  useEffect(() => {
    // Custom split starts on its first amount, past Reset to even.
    (
      formRef.current?.querySelector<HTMLElement>(
        step === "custom" ? "input" : "input,button,[tabindex]",
      ) ?? formRef.current
    )?.focus();
  }, [step]);
  const money = (value: string | bigint) => expenseMoney(String(value), meta);
  function change() {
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
      setExact(customEntry);
      setValidation(null);
      setStep("cost");
      return;
    }
    if (step !== "cost") {
      setStep("cost");
      return;
    }
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
    total = costTotal(total, basis === "per_person", selected.length);
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
  // The Split row opens members; its "Split with custom amounts" link opens
  // the amounts.
  function openSplit() {
    setValidation(null);
    setStep("members");
  }
  function balanceShares() {
    setExact((v) => ({ ...v, ...evenInputs(remaining.toString(), untouched) }));
    change();
    // This button is about to disappear; don't drop keyboard focus with it.
    submitRef.current?.focus();
  }
  function resetShares() {
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
        if (coverer && plannedCoverInvalid(coverAmount, total, meta.decimals))
          throw new Error(
            "The planned reservation must be within the expense total.",
          );
        change();
        setStep("cost");
        return;
      }
      if (picking && !picked) throw new Error("Choose an activity first.");
      if (problem) throw new Error(problem);
      if (coverer && plannedCoverInvalid(coverAmount, total, meta.decimals))
        throw new Error("Check the planned reservation amount.");
      input = {
        activity_id: activity.id,
        ...(prepTask && !initial ? { prep_task_id: prepTask.id } : {}),
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
        ).catch((cause: unknown) => {
          if (cause instanceof ApiError && cause.status === 403)
            onForbidden?.(cause);
          throw cause;
        });
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
              : picking
                ? "Add group expense"
                : "Add expense";
  const day = Temporal.PlainDate.from(date).toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const subtitle =
    step === "cost"
      ? [activity.title, day].filter(Boolean).join(" · ")
      : step === "members"
        ? selected.length === people.length
          ? `All ${people.length} members`
          : `${selected.length} of ${people.length} members`
        : `${description || "Expense"} · ${money(total)}`;
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
      {...expenseModalProps}
      title={title}
      description={subtitle}
      busy={busy}
      onOpenChange={(open) => {
        if (!open) back();
      }}
      footer={
        <div className="flex gap-3 sm:justify-end max-sm:[&>*]:flex-1 [&>[data-slot=button]]:justify-center!">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={back}
          >
            {step === "cost" ? "Cancel" : "Back"}
          </Button>
          <Button ref={submitRef} type="submit" form={formID} disabled={busy}>
            {reviewing ? "Reviewing…" : pending ? "Saving…" : footerLabel}
          </Button>
        </div>
      }
    >
      <form
        tabIndex={-1}
        ref={formRef}
        id={formID}
        className="figma-expense-form [padding-top:0.5rem]"
        onChange={change}
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          return submit();
        }}
      >
        <fieldset disabled={busy} className="min-w-0 space-y-5">
          {step === "cost" && prepTask && (
            <div className="flex items-center gap-2.5 rounded-xl bg-secondary p-3">
              <ListChecksIcon
                aria-hidden="true"
                className="size-[1.125rem] shrink-0 text-primary"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold break-words">
                  For: {prepTask.title}
                </p>
                {activity.id && (
                  <p className="text-[0.8125rem] break-words text-muted-foreground">
                    Also shows on {activity.title}
                  </p>
                )}
              </div>
            </div>
          )}
          {step === "cost" && picking && (
            <ActivityPicker
              id={`${formID}-activity`}
              required
              activities={activities}
              zone={zone}
              value={picked}
              onChange={(value) => {
                setPicked(value);
                change();
              }}
            />
          )}
          {step === "cost" && (
            <CostStep
              formID={formID}
              description={description}
              setDescription={setDescription}
              selectName={!!defaultName && description === defaultName}
              basis={basis}
              setBasis={setBasis}
              mode={mode}
              setMode={setMode}
              amount={amount}
              setAmount={setAmount}
              currency={currency}
              setCurrency={setCurrency}
              currencies={currencies}
              meta={meta}
              problem={problem}
              shares={shares}
              total={total}
              selected={selected}
              coverer={coverer}
              people={people}
              plannedLabel={plannedLabel}
              money={money}
              change={change}
              invalid={invalid}
              openSplit={openSplit}
              setStep={setStep}
            />
          )}
          {step === "review" && review && (
            <ReviewStep review={review} people={people} money={money} />
          )}
          {step === "members" && (
            <>
              <MembersStep
                people={people}
                selected={selected}
                setSelected={setSelected}
                change={change}
              />
              {/* Not in the Figma frame: keeps custom amounts reachable. */}
              <Button
                type="button"
                variant="link"
                className="-my-2 min-h-11 px-0"
                onClick={() =>
                  selected.length
                    ? openCustomSplit()
                    : invalid("Include at least one member.")
                }
              >
                Split with custom amounts
              </Button>
            </>
          )}
          {step === "custom" && (
            <>
              <Button
                type="button"
                variant="link"
                className="-my-2 min-h-11 px-0"
                onClick={resetShares}
              >
                Reset to even
              </Button>
              <CustomSharesStep
                formID={formID}
                selectedPeople={selectedPeople}
                meta={meta}
                exact={exact}
                setExact={setExact}
                setEditedShares={setEditedShares}
                readShare={readShare}
                firstClickSelectsRef={firstClickSelects}
                change={change}
              />
              <SplitStatusFooter
                unassigned={unassigned}
                assigned={assigned}
                total={total}
                canBalance={canBalance}
                untouched={untouched}
                remaining={remaining}
                busy={busy}
                money={money}
                balanceShares={balanceShares}
              />
            </>
          )}
          {step === "coverer" && (
            <CovererStep
              formID={formID}
              coverer={coverer}
              setCoverer={setCoverer}
              coverAmount={coverAmount}
              setCoverAmount={setCoverAmount}
              currency={meta}
              people={people}
              recordsPayment={recordsPayment && !initial}
            />
          )}
          {failure && (
            <div ref={feedback} tabIndex={-1}>
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
