"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ApiError, useApi } from "@/lib/api";
import { Temporal } from "@js-temporal/polyfill";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { TripDialog } from "@/components/shared/trip-dialog";
import { TripError } from "@/components/shared/trip-states";
import { CostStep } from "@/components/features/expenses/drawers/cost-editor/cost-step";
import { CovererStep } from "@/components/features/expenses/drawers/cost-editor/coverer-step";
import { CustomSharesStep } from "@/components/features/expenses/drawers/cost-editor/custom-shares-step";
import { MembersStep } from "@/components/features/expenses/drawers/cost-editor/members-step";
import { ReviewStep } from "@/components/features/expenses/drawers/cost-editor/review-step";
import { SplitStatusFooter } from "@/components/features/expenses/drawers/cost-editor/split-status-footer";

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
      className="activity-details-dialog expense-flow-dialog [&_[data-slot='input']]:min-h-12 [&_[data-slot='input']]:rounded-[0.875rem] [&_[data-slot='select-trigger']]:[min-height:3rem] [&_[data-slot='select-trigger']]:[border-radius:0.875rem] [&_[data-slot='trip-dialog-footer']_.expense-split-status_[data-slot='button']]:[min-height:44px] [&_[data-slot='trip-dialog-footer']_.expense-split-status_[data-slot='button']]:[padding:0] [&_[data-slot='trip-dialog-footer']_.expense-split-status_[data-slot='button']]:[text-align:left] [&_[data-slot='trip-dialog-footer']_.expense-split-status_[data-slot='button']]:[white-space:normal] [&_.activity-detail-navigation_.trip-people[data-slot='button']]:[min-width:44px] [&_.activity-detail-navigation_.trip-people[data-slot='button']]:[justify-content:flex-end] [&_.activity-detail-navigation_.trip-people[data-slot='button']]:[border-radius:9999px] [&_.activity-detail-navigation_.trip-people[data-slot='button']:focus-visible]:[outline:2px_solid_var(--ring)] [&_.activity-detail-navigation_.trip-people[data-slot='button']:focus-visible]:[outline-offset:2px] [&_[data-slot='select-trigger']_>_svg]:[display:block] [&_.repayment-panel_[data-slot='input']]:[border-radius:0] [&_.repayment-panel_[data-slot='input']]:[border-color:var(--ocean-text)] [&_.repayment-panel_[data-slot='input']]:[background:transparent] [&_.repayment-panel_[data-slot='input']]:[color:#fff] [&_.repayment-panel_[data-slot='input']]:[caret-color:#fff] [&_.repayment-panel_[data-slot='input']:focus-visible]:[outline:2px_solid_var(--aqua)] [&_.repayment-panel_[data-slot='input']:focus-visible]:[outline-offset:4px] [&_.repayment-panel_[data-slot='input']:focus-visible]:[box-shadow:none] [&_.repayment-panel_[data-slot='input'][aria-invalid='true']]:[border-color:#ffd5ca] [&_.repayment-panel_[data-slot='input'][aria-invalid='true']]:[box-shadow:none]"
      variant="expense"
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
            className="figma-summary-action px-0 [&[data-slot='button']]:[min-height:44px] [&[data-slot='button']]:[margin-block:-0.625rem] [&[data-slot='button']]:[margin-left:auto] [&[data-slot='button']]:[white-space:normal]"
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
            className="trip-people [&[data-slot='button']]:[border-radius:9999px] [&[data-slot='button']]:[padding-inline:0.375rem]"
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
              <span
                aria-hidden="true"
                className="trip-people-avatars [display:flex] [&>span]:[display:grid] [&>span]:[min-width:2rem] [&>span]:[min-height:2rem] [&>span]:[place-items:center] [&>span]:[border:2px_solid_var(--background)] [&>span]:[border-radius:9999px] [&>span]:[background:var(--trip-sea)] [&>span]:[color:var(--foreground)] [&>span]:[padding-inline:0.125rem] [&>span]:[font-size:0.6875rem] [&>span]:[font-weight:600] [&_>_span_+_span]:[margin-left:-0.5rem]"
              >
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
        className="figma-expense-form [padding-top:0.5rem] [&_label]:[color:var(--muted-foreground)] [&_label]:[font-weight:400]"
        onChange={change}
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          return submit();
        }}
      >
        <fieldset disabled={busy} className="space-y-6 min-w-0">
          {step === "cost" && (
            <CostStep
              formID={formID}
              description={description}
              setDescription={setDescription}
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
              openCustomSplit={openCustomSplit}
              setStep={setStep}
            />
          )}
          {step === "review" && review && (
            <ReviewStep review={review} people={people} money={money} />
          )}
          {step === "members" && (
            <MembersStep
              people={people}
              selected={selected}
              setSelected={setSelected}
              change={change}
            />
          )}
          {step === "custom" && (
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
          )}
          {step === "coverer" && (
            <CovererStep
              formID={formID}
              coverer={coverer}
              setCoverer={setCoverer}
              coverAmount={coverAmount}
              setCoverAmount={setCoverAmount}
              currency={currency}
              people={people}
            />
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
