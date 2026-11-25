"use client";

import { rowTitle } from "@/components/features/expenses/card-row";
import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BorrowListLink } from "@/components/features/expenses/borrow-list-link";
import { ExpenseTotals } from "@/components/features/expenses/expense-totals";
import { ExpensesRow } from "@/components/features/expenses/expenses-row";
import { ExpenseViewTabs } from "@/components/features/expenses/expense-view-tabs";
import { OtherBalances } from "@/components/features/expenses/other-balances";
import { CostArticle } from "@/components/features/expenses/cost-article";
import { LoanArticle } from "@/components/features/expenses/loan-article";
import { ReceiptRows } from "@/components/features/expenses/receipt-rows";
import { ApiError } from "@/lib/api";
import { matchesActivity, personalTotals } from "@/lib/activity-expenses";
import {
  expenseName,
  tripPeople,
  type Expense,
  type ExpenseInput,
  type TransactionInput,
  type FinancialRecord,
  type LedgerKind,
  type Settlement,
  type Debt,
  type ReceiptHistory,
} from "@/lib/expenses";
import { moneyIn } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ExpenseCostEditor } from "@/components/features/expenses/drawers/cost-editor/expense-cost-editor";
import { ExpensePaymentWorkspace } from "@/components/features/expenses/drawers/payment-workspace/expense-payment-workspace";
import { PersonalPayments } from "@/components/features/expenses/personal-payments/personal-payments";
import { PlusIcon } from "@phosphor-icons/react";
import { TripError } from "@/components/shared/trip-states";
import type { ExpenseEditor } from "@/components/features/expenses/activity-expense-form/activity-expense-form";
import { ExpenseEditorDialog } from "@/components/features/expenses/dialogs/expense-editor-dialog";
import { ReceiptHistoryDialog } from "@/components/features/expenses/dialogs/receipt-history-dialog";
import {
  useFinance,
  type Context,
} from "@/components/features/expenses/use-finance";

export type ActivityExpenseView = "overview" | "details" | "personal" | "loans";

export function ActivityExpenses(
  props: Context & {
    activityID: string;
    activityTitle: string;
    activities?: { id: number; title: string }[];
    autoAdd?: boolean;
    compact?: boolean;
    managementOnly?: boolean;
    view?: ActivityExpenseView;
    onViewChange?: (view: ActivityExpenseView) => void;
  },
) {
  const { trip, current, participants, activityID, activityTitle } = props;
  const flow = props.view !== undefined;
  const tabView = props.view === "details" || props.view === "personal";
  const showCosts = !flow || props.view === "details";
  const showLoans = !flow || props.view === "loans";
  const hasActivity = Number(activityID) > 0;
  const { api, ledger, currencies } = useFinance(props);
  const params = useSearchParams();
  const auto =
    !props.managementOnly && (props.autoAdd || params.has("addCost"));
  const isEditor = current?.role === "owner" || current?.role === "editor";
  const writable = !!current && current.role !== "viewer";
  const [editor, setEditor] = useState<ExpenseEditor | null>(null);
  const [paymentCost, setPaymentCost] = useState<Expense | null>(null);
  const [autoDismissed, setAutoDismissed] = useState(false);
  const editing =
    editor ??
    (auto && !autoDismissed && isEditor ? { type: "cost" as const } : null);
  const useCostEditor = hasActivity || !!editing?.cost?.prep_task_name;
  const [localError, setLocalError] = useState<Error | null>(null);
  const [history, setHistory] = useState<ReceiptHistory[] | null>(null);
  const [historyID, setHistoryID] = useState<number | null>(null);
  const [historyError, setHistoryError] = useState<Error | null>(null);
  const [revision, setRevision] = useState(0);
  const trigger = useRef<HTMLElement | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const key = useRef("");
  const data = ledger.data;
  const people = tripPeople(data?.people, participants);
  const name = (id: number) =>
    expenseName(people.find((p) => p.user_id === id));
  const money = moneyIn(currencies.data ?? []);
  const costs =
    data?.expenses.filter((e) => matchesActivity(e, activityID)) ?? [];
  const loans = data?.loans.filter((l) => matchesActivity(l, activityID)) ?? [];
  const ownLoans = loans.filter((l) => l.from_user_id === current?.user_id);
  // Each repayment needs its loan, so several loans name the borrower.
  const repayable = ownLoans.flatMap((loan) => {
    const debt = data?.debts.find((d) => d.loan_id === loan.id);
    return writable && debt && BigInt(debt.amount_minor) > 0n
      ? [{ loan, debt }]
      : [];
  });
  const codes = [...new Set([...costs, ...loans].map((e) => e.currency))];
  const hasOtherBalances =
    !!data &&
    ((activityID === "unassigned" &&
      data.settlements.some((s) => !s.payment_id && !s.loan_id)) ||
      !!data.reversed_settlements?.length);
  const options =
    props.activities ??
    (hasActivity ? [{ id: Number(activityID), title: activityTitle }] : []);
  function open(next: ExpenseEditor) {
    trigger.current = document.activeElement as HTMLElement;
    key.current = crypto.randomUUID();
    api.reset();
    setLocalError(null);
    setEditor(next);
  }
  function close() {
    if (api.pending) return;
    setEditor(null);
    setAutoDismissed(true);
    key.current = "";
    api.reset();
  }
  async function save(input: ExpenseInput | TransactionInput) {
    if (!editing || !writable)
      throw new ApiError(403, "You no longer have permission to save.");
    if (!key.current) key.current = crypto.randomUUID();
    let saved: FinancialRecord | true | undefined;
    if (editing.type === "cost") {
      if (!isEditor)
        throw new ApiError(403, "Only a planner/editor can manage costs.");
      saved = await api.saveExpense(
        input as ExpenseInput,
        editing.cost,
        key.current,
      );
    } else if (editing.type === "payment") {
      if (!isEditor)
        throw new ApiError(
          403,
          "Only a planner/editor can confirm business payments.",
        );
      saved = await api.saveTransaction(
        "expense_payments",
        input as TransactionInput,
        editing.payment,
        key.current,
      );
    } else if (editing.type === "loan") {
      const value = input as TransactionInput;
      if (value.from_user_id !== current?.user_id)
        throw new ApiError(403, "Record only money you personally lent.");
      saved = await api.saveTransaction(
        "expense_loans",
        value,
        undefined,
        key.current,
      );
    } else if (editing.type === "repayment") {
      const value = input as TransactionInput;
      if (!editing.receipt && value.to_user_id !== current?.user_id)
        throw new ApiError(
          403,
          "Only the recipient can confirm money received.",
        );
      saved = await api.saveSettlement(
        {
          currency: value.currency,
          amount_minor: value.amount_minor,
          paid_on: value.paid_on,
          from_user_id: value.from_user_id!,
          to_user_id: value.to_user_id!,
          payment_id: value.payment_id,
          loan_id: value.loan_id,
          correction_reason: value.correction_reason,
          ...(editing.receipt ? { version: editing.receipt.version } : {}),
        },
        editing.receipt,
        key.current,
      );
    }
    if (!saved) return;
    setEditor(null);
    setAutoDismissed(true);
    key.current = "";
  }
  async function reverse(kind: LedgerKind, record: FinancialRecord) {
    const reason =
      kind === "settlements"
        ? window.prompt("Why are you reversing this receipt?")
        : undefined;
    if (kind === "settlements" && !reason?.trim()) return;
    if (
      !window.confirm(
        kind === "expense_loans"
          ? "Remove this loan? Balances will change."
          : "Reverse this recorded payment? Balances will change.",
      )
    )
      return;
    try {
      await api.remove(kind, record, reason ?? undefined);
      if (props.view === "loans")
        heading.current?.focus({ preventScroll: true });
    } catch (cause) {
      setLocalError(cause as Error);
    }
  }
  async function showHistory(id: number) {
    setHistoryID(id);
    setHistory(null);
    setHistoryError(null);
    try {
      setHistory(await api.receiptHistory(id));
    } catch (cause) {
      setHistoryError(cause as Error);
    }
  }
  const canCorrect = (s: Settlement) =>
    writable && (isEditor || s.to_user_id === current?.user_id);
  const debtFor = (s: Settlement): Debt | undefined =>
    data?.debts.find(
      (d) =>
        d.payment_id === s.payment_id &&
        d.loan_id === s.loan_id &&
        d.from_user_id === s.from_user_id &&
        d.to_user_id === s.to_user_id,
    );
  const receiptRows = (receipts: Settlement[]) => (
    <ReceiptRows
      receipts={receipts}
      name={name}
      money={money}
      showHistory={showHistory}
      canCorrect={canCorrect}
      debtFor={debtFor}
      open={open}
      reverse={reverse}
      api={api}
    />
  );
  return (
    <section
      className={
        flow
          ? cn(
              "activity-finance group/finance space-y-4",
              props.view === "overview" && "space-y-0",
            )
          : props.compact
            ? "activity-cost-section"
            : "space-y-4 pt-4"
      }
      aria-label={`Expenses for ${activityTitle}`}
      data-finance-view={props.view}
    >
      {tabView && (
        <ExpenseViewTabs
          view={props.view}
          activityID={activityID}
          onViewChange={props.onViewChange}
        />
      )}
      {!props.managementOnly && !flow && (
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3.5 **:data-[slot=button]:min-h-12 **:data-[slot=button]:px-4 **:data-[slot=button]:text-sm **:data-[slot=button]:font-bold">
          <h3
            ref={heading}
            tabIndex={-1}
            className="text-[22px] leading-[1.4] font-bold"
          >
            Expenses
          </h3>
          {hasActivity && (
            <div className="flex flex-wrap gap-2">
              {writable && (
                <Button
                  variant="outline"
                  onClick={() => open({ type: "loan" })}
                >
                  Record money lent
                </Button>
              )}
              {isEditor && (
                <Button onClick={() => open({ type: "cost" })}>
                  Add expense
                </Button>
              )}
            </div>
          )}
        </div>
      )}
      <div
        id={tabView ? `expense-panel-${activityID}` : undefined}
        role={tabView ? "tabpanel" : undefined}
        aria-labelledby={
          tabView ? `expense-${props.view}-${activityID}` : undefined
        }
        tabIndex={tabView ? 0 : undefined}
        className={
          flow
            ? "space-y-5 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ring"
            : "space-y-4"
        }
      >
        {(ledger.isPending || currencies.isPending) && (
          <p role="status">Loading expenses…</p>
        )}
        {(ledger.error || currencies.error) && (
          <TripError
            error={ledger.error ?? currencies.error}
            retry={() => {
              void ledger.refetch();
              void currencies.refetch();
            }}
          />
        )}
        {localError && <TripError error={localError} />}
        {data && currencies.data && (
          <>
            {!props.managementOnly && showCosts && (
              <ExpenseTotals
                codes={
                  flow ? [...new Set(costs.map((c) => c.currency))] : codes
                }
                costs={costs}
                data={data}
                current={current}
                activityID={activityID}
                money={money}
                view={props.view}
              />
            )}
            {props.view === "details" && !props.managementOnly && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className={rowTitle}>
                  {costs.length} {costs.length === 1 ? "expense" : "expenses"}
                </h3>
                {hasActivity && isEditor && (
                  <Button
                    variant="link"
                    className="min-h-11 px-0"
                    onClick={() => open({ type: "cost" })}
                  >
                    <PlusIcon aria-hidden="true" />
                    Add expense
                  </Button>
                )}
              </div>
            )}
            {props.view === "loans" && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 ref={heading} tabIndex={-1} className={rowTitle}>
                  {ownLoans.length} {ownLoans.length === 1 ? "loan" : "loans"}
                </h3>
                {writable && hasActivity && (
                  <Button
                    variant="link"
                    className="min-h-11 px-0"
                    onClick={() => open({ type: "loan" })}
                  >
                    <PlusIcon aria-hidden="true" />
                    Add borrow
                  </Button>
                )}
              </div>
            )}
            {showCosts && !costs.length && (!loans.length || flow) && (
              <p className="text-muted-foreground">
                No expenses yet.
                {isEditor
                  ? " Add entrance fees, rooms, or other activity costs."
                  : ""}
              </p>
            )}
            {props.view === "overview" && (
              <ExpensesRow
                costs={costs}
                share={(code) =>
                  personalTotals(data, current?.user_id ?? 0, code, activityID)
                    .cost
                }
                money={money}
                onOpen={() => props.onViewChange?.("details")}
              />
            )}
            {!props.managementOnly && (!flow || props.view === "personal") && (
              <PersonalPayments
                {...props}
                ledger={data}
                currencies={currencies.data}
                showExpenses={flow}
              />
            )}
            {(showCosts || showLoans) && (
              <div
                className={
                  props.view === "details" ||
                  (props.view === "loans" && ownLoans.length > 0)
                    ? "divide-y overflow-hidden rounded-[16px] border bg-card"
                    : undefined
                }
              >
                {showCosts &&
                  costs.map((cost) => (
                    <CostArticle
                      key={cost.id}
                      cost={cost}
                      data={data}
                      flow={flow}
                      compact={props.compact}
                      managementOnly={props.managementOnly}
                      isEditor={isEditor}
                      name={name}
                      money={money}
                      triggerRef={trigger}
                      setPaymentCost={setPaymentCost}
                      open={open}
                      reverse={reverse}
                      api={api}
                      receiptRows={receiptRows}
                    />
                  ))}
                {showLoans &&
                  (flow ? ownLoans : loans).map((loan) => (
                    <LoanArticle
                      key={`loan-${loan.id}`}
                      loan={loan}
                      data={data}
                      current={current}
                      writable={writable}
                      isEditor={isEditor}
                      flow={flow}
                      compact={props.compact}
                      managementOnly={props.managementOnly}
                      name={name}
                      money={money}
                      open={open}
                      reverse={reverse}
                      api={api}
                      receiptRows={receiptRows}
                    />
                  ))}
                {props.view === "details" && (
                  <BorrowListLink
                    ownLoans={ownLoans}
                    money={money}
                    onViewChange={props.onViewChange}
                  />
                )}
              </div>
            )}
            {props.view === "loans" && (
              <>
                {repayable.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {repayable.map(({ loan, debt }) => (
                      <Button
                        key={loan.id}
                        variant="outline"
                        disabled={api.pending}
                        onClick={() => open({ type: "repayment", debt })}
                      >
                        {repayable.length === 1
                          ? "Record repayment"
                          : `Record repayment · ${name(loan.to_user_id)}`}
                      </Button>
                    ))}
                  </div>
                )}
                {!ownLoans.length && (
                  <p className="text-muted-foreground">
                    You haven’t recorded any money lent for this activity.
                  </p>
                )}
              </>
            )}
            {!props.compact && hasOtherBalances && (
              <OtherBalances
                activityID={activityID}
                data={data}
                isEditor={isEditor}
                name={name}
                money={money}
                open={open}
                showHistory={showHistory}
              />
            )}
            {current?.role === "viewer" && (
              <p className="text-sm text-muted-foreground">Read-only access</p>
            )}
          </>
        )}
      </div>
      {paymentCost && (
        <ExpensePaymentWorkspace
          trip={trip}
          participants={participants}
          cost={
            data?.expenses.find((c) => c.id === paymentCost.id) ?? paymentCost
          }
          currency={
            currencies.data?.find((c) => c.code === paymentCost.currency) ?? {
              code: paymentCost.currency,
              decimals: 2,
            }
          }
          current={current}
          finalFocus={() =>
            trigger.current?.isConnected ? trigger.current : heading.current
          }
          onBack={() => setPaymentCost(null)}
          backLabel={flow || !hasActivity ? "Back to expenses" : undefined}
          onFailure={props.onFailure}
        />
      )}
      {editing?.type === "cost" && useCostEditor && currencies.data && (
        <ExpenseCostEditor
          recordsPayment
          tripID={trip.id}
          key={`${revision}-${editing.cost?.id ?? "new"}`}
          activity={{
            id: Number(activityID) || undefined,
            title: activityTitle,
          }}
          initial={editing.cost}
          defaultName={
            hasActivity && !editing.cost && !costs.length
              ? activityTitle
              : undefined
          }
          people={people.filter(
            (p) =>
              editing.cost?.shares.some((s) => s.user_id === p.user_id) ||
              !participants ||
              participants.some((m) => m.user_id === p.user_id),
          )}
          currencies={currencies.data}
          zone={trip.time_zone}
          pending={api.pending || !isEditor}
          error={api.error}
          finalFocus={() =>
            trigger.current?.isConnected ? trigger.current : heading.current
          }
          onSave={save}
          onReload={
            editing.cost
              ? async () => {
                  const latest = await api.get<Expense>(
                    "expenses",
                    editing.cost!.id,
                  );
                  setEditor({ ...editing, cost: latest });
                  setRevision((n) => n + 1);
                  api.reset();
                }
              : undefined
          }
          onBack={() => {
            setEditor(null);
            setAutoDismissed(true);
          }}
          onDirty={() => api.reset()}
        />
      )}
      <ExpenseEditorDialog
        editing={editing}
        editor={editor}
        setEditor={setEditor}
        useCostEditor={useCostEditor}
        activityID={activityID}
        activityTitle={activityTitle}
        options={options}
        people={people}
        participants={participants}
        current={current}
        trip={trip}
        data={data}
        currencies={currencies.data}
        api={api}
        writable={writable}
        revision={revision}
        setRevision={setRevision}
        localError={localError}
        setLocalError={setLocalError}
        save={save}
        close={close}
        finalFocus={() =>
          trigger.current?.isConnected ? trigger.current : heading.current
        }
      />
      <ReceiptHistoryDialog
        historyID={historyID}
        setHistoryID={setHistoryID}
        history={history}
        historyError={historyError}
        showHistory={showHistory}
        name={name}
        money={money}
      />
    </section>
  );
}
