"use client";

import { useRef, useState, type ReactNode, type RefObject } from "react";
import { PlusIcon, ReceiptIcon, UserIcon } from "@phosphor-icons/react";
import type { ExpenseEditor } from "@/components/features/expenses/activity-expense-form/activity-expense-form";
import { ConfirmRemovalDialog } from "@/components/features/expenses/dialogs/confirm-removal-dialog";
import { ExpenseEditorDialog } from "@/components/features/expenses/dialogs/expense-editor-dialog";
import { MarkAsPaidDialog } from "@/components/features/expenses/dialogs/mark-as-paid-dialog";
import { PersonalExpenseDialog } from "@/components/features/expenses/dialogs/personal-expense-dialog";
import { LoanDetails } from "@/components/features/expenses/drawers/loan-details";
import { PersonalExpenseDetails } from "@/components/features/expenses/drawers/personal-expense-details";
import {
  ExpenseEmpty,
  ExpenseFilters,
} from "@/components/features/expenses/expense-list-parts";
import {
  ExpensesHeading,
  type ExpenseMode,
} from "@/components/features/expenses/mode-switch";
import { PersonalExpenseList } from "@/components/features/expenses/personal-expense-list";
import { SummaryPanel } from "@/components/features/expenses/summary-panel";
import type {
  Context,
  useFinance,
} from "@/components/features/expenses/use-finance";
import { OptionsMenu } from "@/components/shared/options-menu";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import {
  matchesPersonal,
  personalFilters,
  personalRows,
  personalSummary,
  type PersonalFilter,
  type PersonalRow,
} from "@/lib/expense-views";
import {
  canManageExpense,
  expenseName,
  tripPeople,
  type ActivityLedger,
  type Currency,
  type Debt,
  type ExpenseInput,
  type Loan,
  type TransactionInput,
} from "@/lib/expenses";
import type { Activity } from "@/lib/itinerary";
import { moneyIn } from "@/lib/money";
import type {
  PersonalExpense,
  PersonalExpenseInput,
  usePersonalExpensesApi,
} from "@/lib/personal-expenses";

const emptyLedger: ActivityLedger = {
  expenses: [],
  payments: [],
  loans: [],
  settlements: [],
  people: [],
  debts: [],
};

/** Private expenses plus money you lent. Either half still works if the other fails to load. */
export function PersonalExpenses({
  headingRef,
  onModeChange,
  errors,
  expenses,
  ledger: loaded,
  activities,
  activitiesError,
  currencies,
  api,
  loans,
  filter,
  setFilter,
  ...context
}: Context & {
  headingRef: RefObject<HTMLHeadingElement | null>;
  onModeChange: (mode: ExpenseMode) => void;
  /** Parts of the page that couldn't load, with their retries. */
  errors: ReactNode;
  /** Undefined when they couldn't load. */
  expenses?: PersonalExpense[];
  ledger?: ActivityLedger;
  activities: Activity[];
  activitiesError: boolean;
  currencies: Currency[];
  api: ReturnType<typeof usePersonalExpensesApi>;
  loans: ReturnType<typeof useFinance>["api"];
  filter: PersonalFilter;
  setFilter: (filter: PersonalFilter) => void;
}) {
  const { trip, participants, current } = context;
  const ledger = loaded ?? emptyLedger;
  const me = current?.user_id ?? 0;
  const canLend = !!loaded && !!current && current.role !== "viewer";
  const [openKey, setOpenKey] = useState("");
  const [editing, setEditing] = useState<{ record?: PersonalExpense } | null>(
    null,
  );
  const [removing, setRemoving] = useState<PersonalRow | null>(null);
  const [lending, setLending] = useState<ExpenseEditor | null>(null);
  const [debt, setDebt] = useState<Debt | null>(null);
  const [revision, setRevision] = useState(0);
  const [localError, setLocalError] = useState<Error | null>(null);
  const key = useRef("");
  const receiptKey = useRef("");
  const trigger = useRef<HTMLElement | null>(null);
  // A deleted row can still be in the page while its dialog closes.
  const removed = useRef("");
  const selectedFilter = useRef<HTMLButtonElement | null>(null);
  const addPill = useRef<HTMLButtonElement | null>(null);
  const people = tripPeople(ledger.people, participants);
  const name = (id: number) =>
    expenseName(people.find((p) => p.user_id === id));
  const money = moneyIn(currencies);
  const all = personalRows(expenses ?? [], ledger, me);
  const rows = all.filter((row) => matchesPersonal(filter, row));
  const keyOf = (row: PersonalRow) => `${row.kind}-${row.record.id}`;
  const opened = all.find((row) => keyOf(row) === openKey);
  const pending = api.pending || loans.pending;
  const rowOf = (id?: string) =>
    id && id !== removed.current
      ? document.querySelector<HTMLElement>(`[data-expense-row="${id}"]`)
      : null;
  const focusBack = (id?: string) =>
    rowOf(id) ??
    (trigger.current?.isConnected ? trigger.current : null) ??
    selectedFilter.current ??
    headingRef.current;
  const complete = !!expenses && !!loaded;

  // Dialogs opened from inside a drawer return to it rather than to the list.
  const returnTo = (id?: string) =>
    trigger.current?.isConnected ? trigger.current : focusBack(id);

  // A menu's own items are gone once it closes, so the Add button takes focus back.
  function edit(record?: PersonalExpense, fromMenu = false) {
    trigger.current = fromMenu
      ? addPill.current
      : (document.activeElement as HTMLElement);
    key.current = crypto.randomUUID();
    api.reset();
    setEditing({ record });
  }
  function lend(fromMenu = false) {
    trigger.current = fromMenu
      ? addPill.current
      : (document.activeElement as HTMLElement);
    key.current = crypto.randomUUID();
    loans.reset();
    setLocalError(null);
    setLending({ type: "loan" });
  }
  function closeLending() {
    if (loans.pending) return;
    setLending(null);
    key.current = "";
    loans.reset();
  }
  async function saveExpense(input: PersonalExpenseInput) {
    const saved = await api.save(input, editing?.record, key.current);
    if (!saved) return;
    key.current = "";
    setEditing(null);
  }
  async function saveLoan(input: ExpenseInput | TransactionInput) {
    const value = input as TransactionInput;
    if (!canLend)
      throw new ApiError(403, "You no longer have permission to save.");
    if (value.from_user_id !== current.user_id)
      throw new ApiError(403, "Record only money you personally lent.");
    const saved = await loans.saveTransaction(
      "expense_loans",
      value,
      undefined,
      key.current,
    );
    if (!saved) return;
    key.current = "";
    setLending(null);
  }
  function remove(row: PersonalRow) {
    trigger.current = document.activeElement as HTMLElement;
    api.reset();
    loans.reset();
    setRemoving(row);
  }
  async function confirmRemoval() {
    if (!removing || pending) return;
    const latest = all.find((row) => keyOf(row) === keyOf(removing));
    if (!latest) throw new ApiError(404, "This record is no longer available.");
    const index = rows.findIndex((row) => keyOf(row) === keyOf(latest));
    const next = rows[index + 1] ?? rows[index - 1];
    const saved =
      latest.kind === "expense"
        ? await api.remove(latest.record)
        : await loans.remove("expense_loans", latest.record);
    if (!saved) return;
    removed.current = keyOf(latest);
    trigger.current = next ? rowOf(keyOf(next)) : null;
    setOpenKey("");
    setRemoving(null);
  }
  function receive(loan: Loan) {
    const found = ledger.debts.find((d) => d.loan_id === loan.id);
    if (!canLend || !found || found.to_user_id !== me) return;
    trigger.current = document.activeElement as HTMLElement;
    loans.reset();
    receiptKey.current = crypto.randomUUID();
    setDebt(found);
  }
  const canRemove = (loan: Loan) =>
    canLend &&
    canManageExpense(current.role, current.user_id, loan.created_by_user_id);
  return (
    <>
      <ExpensesHeading
        headingRef={headingRef}
        mode="personal"
        onModeChange={onModeChange}
      >
        <div className="flex flex-wrap gap-2">
          {canLend && (
            <Button variant="outline" onClick={() => lend()}>
              <UserIcon aria-hidden="true" />
              Money I lent
            </Button>
          )}
          <Button onClick={() => edit()}>
            <PlusIcon aria-hidden="true" />
            Add expense
          </Button>
        </div>
      </ExpensesHeading>
      {errors}
      {all.length > 0 && (
        <SummaryPanel
          label="Personal totals"
          tone="sand"
          groups={personalSummary(all).map((t) => ({
            currency: t.currency,
            cells: [
              ...(expenses
                ? [
                    ["Your personal spend", money(t.spent, t.currency)] as [
                      string,
                      string,
                    ],
                  ]
                : []),
              ...(loaded
                ? [
                    ["Lent, still to get back", money(t.lent, t.currency)] as [
                      string,
                      string,
                    ],
                  ]
                : []),
            ],
          }))}
        />
      )}
      {all.length > 0 && (
        <ExpenseFilters
          options={personalFilters}
          value={filter}
          onChange={setFilter}
          selectedRef={selectedFilter}
        />
      )}
      <p role="status" className="sr-only">
        {all.length > 0 &&
          `${rows.length} of ${all.length} personal records shown`}
      </p>
      {rows.length ? (
        <PersonalExpenseList
          rows={rows}
          activities={activities}
          name={name}
          money={money}
          onOpen={(row) => setOpenKey(keyOf(row))}
        />
      ) : all.length ? (
        <ExpenseEmpty
          title="Nothing matches this filter"
          detail={
            filter === "lent"
              ? "You haven’t recorded any money lent."
              : "You haven’t added any personal expenses."
          }
          action={
            <Button
              variant="outline"
              onClick={() => {
                setFilter("all");
                selectedFilter.current?.focus();
              }}
            >
              Show all
            </Button>
          }
        />
      ) : complete ? (
        <ExpenseEmpty
          title="No personal expenses yet"
          detail={
            canLend
              ? "Add what you paid for yourself, or money you lent to someone."
              : "Add what you paid for yourself. Only you can see it."
          }
          action={
            <Button variant="outline" onClick={() => edit()}>
              <PlusIcon aria-hidden="true" />
              Add personal expense
            </Button>
          }
        />
      ) : null}
      <div className="mobile-add-activity fixed right-[max(1.5rem,env(safe-area-inset-right,0px))] bottom-[var(--app-bottom)] z-30 md:hidden">
        {canLend ? (
          <OptionsMenu
            name="Add"
            trigger={<Button ref={addPill} className="min-h-12" />}
            triggerContent={
              <>
                <PlusIcon aria-hidden="true" />
                Add
              </>
            }
            items={[
              {
                label: "Expense",
                detail: "Something you paid for yourself",
                icon: <ReceiptIcon aria-hidden="true" />,
                onClick: () => edit(undefined, true),
              },
              {
                label: "Money I lent",
                detail: "Someone borrowed from you",
                icon: <UserIcon aria-hidden="true" />,
                onClick: () => lend(true),
              },
            ]}
          />
        ) : (
          <Button className="min-h-12" onClick={() => edit()}>
            <PlusIcon aria-hidden="true" />
            Add
          </Button>
        )}
      </div>
      {opened?.kind === "expense" && (
        <PersonalExpenseDetails
          record={opened.record}
          activities={activities}
          money={money}
          pending={pending}
          onEdit={() => edit(opened.record)}
          onDelete={() => remove(opened)}
          onBack={() => setOpenKey("")}
          finalFocus={() => focusBack(openKey)}
        />
      )}
      {opened?.kind === "loan" && (
        <LoanDetails
          loan={opened.record}
          ledger={ledger}
          activities={activities}
          name={name}
          money={money}
          canReceive={canLend}
          canRemove={canRemove(opened.record)}
          pending={pending}
          onReceive={() => receive(opened.record)}
          onRemove={() => remove(opened)}
          onBack={() => setOpenKey("")}
          finalFocus={() => focusBack(openKey)}
        />
      )}
      {editing && (
        <PersonalExpenseDialog
          key={editing.record?.id ?? "new"}
          record={editing.record}
          activities={activities}
          activitiesError={activitiesError}
          currencies={currencies}
          zone={trip.time_zone}
          pending={api.pending}
          onSave={saveExpense}
          onReload={
            editing.record
              ? async () => {
                  setEditing({ record: await api.get(editing.record!.id) });
                  api.reset();
                }
              : undefined
          }
          onClose={() => {
            if (api.pending) return;
            setEditing(null);
            key.current = "";
            api.reset();
          }}
          finalFocus={() =>
            returnTo(editing.record && `expense-${editing.record.id}`)
          }
        />
      )}
      <ExpenseEditorDialog
        editing={lending}
        editor={lending}
        setEditor={setLending}
        useCostEditor={false}
        activityID=""
        activityTitle=""
        options={activities}
        pickActivities={activities}
        people={people}
        participants={participants}
        current={current}
        trip={trip}
        data={loaded}
        currencies={currencies}
        api={loans}
        writable={canLend}
        revision={revision}
        setRevision={setRevision}
        localError={localError}
        setLocalError={setLocalError}
        save={saveLoan}
        close={closeLending}
        finalFocus={() => returnTo()}
      />
      {current && (
        <MarkAsPaidDialog
          debt={debt}
          setDebt={setDebt}
          api={loans}
          people={people}
          currencies={currencies}
          current={current}
          participants={participants}
          trip={trip}
          ledger={ledger}
          close={() => {
            if (loans.pending) return;
            setDebt(null);
            loans.reset();
          }}
          finalFocus={() =>
            trigger.current?.isConnected
              ? trigger.current
              : document.querySelector<HTMLElement>(
                  '[data-presentation="detail"] h2',
                )
          }
          receiptKey={receiptKey}
          backLabel="Back to loan"
        />
      )}
      {removing && (
        <ConfirmRemovalDialog
          title={
            removing.kind === "loan"
              ? "Remove this loan?"
              : "Delete this personal expense?"
          }
          description={
            removing.kind === "loan"
              ? "This removes the loan for both of you and changes your balances. This cannot be undone."
              : "Only you can see this expense. Deleting it cannot be undone."
          }
          summary={`${removing.record.description} · ${money(removing.record.amount_minor, removing.record.currency)}`}
          confirmLabel={
            removing.kind === "loan" ? "Remove loan" : "Delete expense"
          }
          pending={pending}
          onConfirm={confirmRemoval}
          onClose={() => {
            if (pending) return;
            setRemoving(null);
            api.reset();
            loans.reset();
          }}
          finalFocus={() => returnTo(keyOf(removing))}
        />
      )}
    </>
  );
}
