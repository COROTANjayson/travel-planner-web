"use client";

import { useRef, useState, type ReactNode, type RefObject } from "react";
import { PlusIcon, ReceiptIcon } from "@phosphor-icons/react";
import type { ExpenseEditor } from "@/components/features/expenses/activity-expense-form/activity-expense-form";
import { DeleteExpenseDialog } from "@/components/features/expenses/dialogs/delete-expense-dialog";
import { ExpenseEditorDialog } from "@/components/features/expenses/dialogs/expense-editor-dialog";
import { ExpenseCostEditor } from "@/components/features/expenses/drawers/cost-editor/expense-cost-editor";
import { GroupExpenseDetails } from "@/components/features/expenses/drawers/group-expense-details";
import type { Screen } from "@/components/features/expenses/drawers/payment-workspace/expense-payment-workspace";
import {
  activityPlace,
  ExpenseEmpty,
  ExpenseFilters,
} from "@/components/features/expenses/expense-list-parts";
import {
  ExpensesHeading,
  type ExpenseMode,
} from "@/components/features/expenses/mode-switch";
import { GroupExpenseList } from "@/components/features/expenses/group-expense-list";
import { SummaryPanel } from "@/components/features/expenses/summary-panel";
import type {
  Context,
  useFinance,
} from "@/components/features/expenses/use-finance";
import { Button } from "@/components/ui/button";
import { uncovered } from "@/lib/activity-expenses";
import { ApiError } from "@/lib/api";
import {
  groupFilters,
  groupRows,
  groupTotals,
  matchesGroup,
  type GroupFilter,
} from "@/lib/expense-views";
import {
  expenseName,
  tripPeople,
  type ActivityLedger,
  type Currency,
  type Expense,
  type ExpenseInput,
  type TransactionInput,
} from "@/lib/expenses";
import type { Activity } from "@/lib/itinerary";
import { moneyIn } from "@/lib/money";

/** The shared ledger's expenses, whoever they were split between. */
export function GroupExpenses({
  headingRef,
  onModeChange,
  errors,
  ledger,
  activities,
  currencies,
  api,
  filter,
  setFilter,
  ...context
}: Context & {
  headingRef: RefObject<HTMLHeadingElement | null>;
  onModeChange: (mode: ExpenseMode) => void;
  /** Parts of the page that couldn't load, with their retries. */
  errors: ReactNode;
  ledger: ActivityLedger;
  activities: Activity[];
  currencies: Currency[];
  api: ReturnType<typeof useFinance>["api"];
  filter: GroupFilter;
  setFilter: (filter: GroupFilter) => void;
}) {
  const { trip, participants, current, onFailure } = context;
  const isEditor = current?.role === "owner" || current?.role === "editor";
  const me = current?.user_id ?? 0;
  const [open, setOpen] = useState<{ id: number; screen?: Screen } | null>(
    null,
  );
  const [editing, setEditing] = useState<{ cost?: Expense } | null>(null);
  const [legacy, setLegacy] = useState<ExpenseEditor | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [revision, setRevision] = useState(0);
  const [localError, setLocalError] = useState<Error | null>(null);
  const key = useRef("");
  const trigger = useRef<HTMLElement | null>(null);
  // A deleted row can still be in the page while its dialog closes.
  const removed = useRef(0);
  const selectedFilter = useRef<HTMLButtonElement | null>(null);
  const people = tripPeople(ledger.people, participants);
  const name = (id: number) =>
    expenseName(people.find((p) => p.user_id === id));
  const money = moneyIn(currencies);
  const all = groupRows(ledger, me);
  const rows = all.filter((row) => matchesGroup(filter, row));
  const unpaid = all.filter((row) => row.needsPayment);
  const noPayer = unpaid.filter((row) => row.noPayer).length;
  const opened = open && ledger.expenses.find((e) => e.id === open.id);
  const latestDeleting = ledger.expenses.find((e) => e.id === deleting?.id);
  const rowOf = (id?: number) =>
    id && id !== removed.current
      ? document.querySelector<HTMLElement>(`[data-expense-row="group-${id}"]`)
      : null;
  // The row may have left the list or the filter by the time a dialog closes.
  const focusBack = (id?: number) =>
    rowOf(id) ??
    (trigger.current?.isConnected ? trigger.current : null) ??
    selectedFilter.current ??
    headingRef.current;

  // Dialogs opened from inside a drawer return to it rather than to the list.
  const returnTo = (id?: number) =>
    trigger.current?.isConnected ? trigger.current : focusBack(id);

  // A menu's own items are gone once it closes, so the row takes focus back.
  function edit(cost?: Expense, fromMenu = false) {
    trigger.current = fromMenu ? null : (document.activeElement as HTMLElement);
    key.current = crypto.randomUUID();
    api.reset();
    setLocalError(null);
    // Costs that never had an activity or task keep their existing form.
    if (cost && !cost.activity_id && !cost.prep_task_name)
      setLegacy({ type: "cost", cost });
    else setEditing({ cost });
  }
  function close() {
    if (api.pending) return;
    setEditing(null);
    setLegacy(null);
    key.current = "";
    api.reset();
  }
  async function save(input: ExpenseInput | TransactionInput, cost?: Expense) {
    if (!isEditor)
      throw new ApiError(403, "Only a planner/editor can manage costs.");
    const saved = await api.saveExpense(
      input as ExpenseInput,
      cost,
      key.current,
    );
    if (!saved) return;
    key.current = "";
    setEditing(null);
    setLegacy(null);
  }
  function pay(cost: Expense) {
    const left = uncovered(cost, ledger).reduce(
      (n, s) => n + BigInt(s.amount_minor),
      0n,
    );
    // Once the business is paid, only each recipient can record repayments.
    setOpen({ id: cost.id, screen: left > 0n ? "reservation" : null });
  }
  function remove(cost: Expense, fromMenu = false) {
    if (!isEditor || api.pending) return;
    trigger.current = fromMenu ? null : (document.activeElement as HTMLElement);
    api.reset();
    setDeleting(cost);
  }
  async function confirmRemoval() {
    if (api.pending || !deleting) return;
    if (!isEditor)
      throw new ApiError(
        403,
        "You no longer have permission to delete expenses.",
      );
    if (!latestDeleting)
      throw new ApiError(404, "This expense is no longer available.");
    const index = rows.findIndex((r) => r.expense.id === latestDeleting.id);
    const next = rows[index + 1] ?? rows[index - 1];
    const saved = await api.remove("expenses", latestDeleting);
    if (!saved) return;
    removed.current = latestDeleting.id;
    trigger.current = rowOf(next?.expense.id);
    setOpen(null);
    setDeleting(null);
  }
  const add = (className?: string, outline = false) =>
    isEditor && (
      <Button
        variant={outline ? "outline" : "default"}
        className={className}
        onClick={() => edit()}
      >
        <PlusIcon aria-hidden="true" />
        Add group expense
      </Button>
    );
  return (
    <>
      <ExpensesHeading
        headingRef={headingRef}
        mode="group"
        onModeChange={onModeChange}
      >
        {add()}
      </ExpensesHeading>
      {errors}
      {all.length > 0 && (
        <SummaryPanel
          label="Group totals"
          tone="sea"
          groups={groupTotals(ledger, me).map((t) => ({
            currency: t.currency,
            cells: [
              ["Group total", money(t.total, t.currency)],
              ["Your share", money(t.share, t.currency)],
              ["You owe", money(t.owe, t.currency)],
              ["You’re owed", money(t.owed, t.currency)],
            ],
          }))}
        />
      )}
      {current && !isEditor && (
        <p className="rounded-xl bg-muted px-3 py-2.5 text-xs leading-5 font-semibold text-muted-foreground md:px-4 md:py-3 md:text-[13px] md:leading-[21px]">
          Only editors can change group expenses.
        </p>
      )}
      {isEditor && unpaid.length > 0 && (
        <div className="flex items-center gap-2.5 rounded-xl bg-[var(--trip-sand)] px-3 py-1 text-[#625333] md:px-4">
          <ReceiptIcon aria-hidden="true" className="size-[18px] shrink-0" />
          <p className="min-w-0 flex-1 text-xs leading-5 font-semibold md:text-[13px] md:leading-[21px]">
            {unpaid.length}{" "}
            {unpaid.length === 1
              ? "expense still needs payment"
              : "expenses still need payment"}
            {noPayer > 0 &&
              ` · ${noPayer} ${noPayer === 1 ? "has" : "have"} no payer yet`}
          </p>
          <Button
            variant="link"
            className="min-h-11 px-2"
            aria-label="Show expenses that need payment"
            onClick={() => setFilter("payment")}
          >
            Show
          </Button>
        </div>
      )}
      {all.length > 0 && (
        <ExpenseFilters
          options={groupFilters}
          value={filter}
          onChange={setFilter}
          selectedRef={selectedFilter}
        />
      )}
      <p role="status" className="sr-only">
        {all.length > 0 &&
          `${rows.length} of ${all.length} group expenses shown`}
      </p>
      {rows.length ? (
        <GroupExpenseList
          rows={rows}
          activities={activities}
          name={name}
          money={money}
          isEditor={isEditor}
          disabled={api.pending}
          onOpen={(cost) => setOpen({ id: cost.id })}
          onPay={pay}
          onEdit={(cost) => edit(cost, true)}
          onDelete={(cost) => remove(cost, true)}
        />
      ) : all.length ? (
        <ExpenseEmpty
          title="Nothing matches this filter"
          detail={`No group expenses under ${groupFilters[filter]}.`}
          action={
            <Button
              variant="outline"
              onClick={() => {
                setFilter("all");
                selectedFilter.current?.focus();
              }}
            >
              Show all expenses
            </Button>
          }
        />
      ) : (
        <ExpenseEmpty
          title="No group expenses yet"
          detail="Add costs the group shares, like tours, rooms and transfers."
          action={add(undefined, true)}
        />
      )}
      {all.length > 0 && add("w-full md:hidden")}
      {opened && (
        <GroupExpenseDetails
          key={opened.id}
          trip={trip}
          cost={opened}
          currency={
            currencies.find((c) => c.code === opened.currency) ?? {
              code: opened.currency,
              decimals: 2,
            }
          }
          current={current}
          participants={participants}
          onFailure={onFailure}
          ledger={ledger}
          activities={activities}
          name={name}
          money={money}
          isEditor={isEditor}
          pending={api.pending}
          initialScreen={open.screen}
          onEdit={() => edit(opened)}
          onDelete={() => remove(opened)}
          onBack={() => setOpen(null)}
          finalFocus={() => focusBack(opened.id)}
        />
      )}
      {editing && (
        <ExpenseCostEditor
          recordsPayment
          key={`${revision}-${editing.cost?.id ?? "new"}`}
          tripID={trip.id}
          activity={{
            id: editing.cost?.activity_id,
            title: editing.cost ? activityPlace(editing.cost, activities) : "",
          }}
          activities={editing.cost ? undefined : activities}
          initial={editing.cost}
          people={people.filter(
            (p) =>
              editing.cost?.shares.some((s) => s.user_id === p.user_id) ||
              !participants ||
              participants.some((m) => m.user_id === p.user_id),
          )}
          currencies={currencies}
          zone={trip.time_zone}
          pending={api.pending}
          error={api.error}
          finalFocus={() => returnTo(editing.cost?.id)}
          onSave={(input) => save(input, editing.cost)}
          onReload={
            editing.cost
              ? async () => {
                  const latest = await api.get<Expense>(
                    "expenses",
                    editing.cost!.id,
                  );
                  setEditing({ cost: latest });
                  setRevision((n) => n + 1);
                  api.reset();
                }
              : undefined
          }
          onForbidden={(error) => void onFailure(error)}
          onBack={close}
          onDirty={() => api.reset()}
        />
      )}
      <ExpenseEditorDialog
        editing={legacy}
        editor={legacy}
        setEditor={setLegacy}
        useCostEditor={false}
        activityID="unassigned"
        activityTitle={
          legacy?.cost ? activityPlace(legacy.cost, activities) : ""
        }
        options={activities}
        people={people}
        participants={participants}
        current={current}
        trip={trip}
        data={ledger}
        currencies={currencies}
        api={api}
        writable={isEditor}
        revision={revision}
        setRevision={setRevision}
        localError={localError}
        setLocalError={setLocalError}
        save={(input) => save(input, legacy?.cost)}
        close={close}
        finalFocus={() => returnTo(legacy?.cost?.id)}
      />
      {deleting && (
        <DeleteExpenseDialog
          cost={latestDeleting ?? deleting}
          hasPayments={ledger.payments.some(
            (p) => p.expense_id === deleting.id,
          )}
          isEditor={isEditor}
          available={!!latestDeleting}
          pending={api.pending}
          money={money}
          onDelete={confirmRemoval}
          onClose={() => {
            if (api.pending) return;
            setDeleting(null);
            api.reset();
          }}
          finalFocus={() => returnTo(latestDeleting?.id)}
        />
      )}
    </>
  );
}
