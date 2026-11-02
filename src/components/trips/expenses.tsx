"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { ApiError, useApi } from "@/lib/api";
import type { Participant } from "@/lib/memberships";
import type { Trip } from "@/lib/trips";
import type { Activity } from "@/lib/itinerary";
import { activityKey, personalTotals } from "@/lib/activity-expenses";
import {
  expenseName,
  useExpensesApi,
  type Expense,
  type ExpenseInput,
  type TransactionInput,
  type FinancialRecord,
  type LedgerKind,
  type Settlement,
  type Debt,
  type ReceiptHistory,
} from "@/lib/expenses";
import { expenseMoney as formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { ExpenseCostEditor } from "./expense-cost-editor";
import { ExpensePaymentWorkspace } from "./expense-payment-workspace";
import { TripDialog } from "./trip-dialog";
import { TripError } from "./trip-states";
import {
  ActivityExpenseForm,
  type ExpenseEditor,
} from "./activity-expense-form";

type Context = {
  trip: Trip;
  participants?: Participant[];
  current?: Participant;
  onFailure: (error: Error) => void | Promise<void>;
};
function useFinance({ trip, onFailure }: Context, active = true) {
  const api = useExpensesApi(trip.id, onFailure);
  const ledger = useQuery({
    queryKey: ["trip", trip.id, "ledger", "activity"],
    queryFn: ({ signal }) => api.ledger(signal),
    enabled: active,
    retry: false,
  });
  const currencies = useQuery({
    queryKey: ["expense-currencies"],
    queryFn: ({ signal }) => api.currencies(signal),
    enabled: active,
    retry: false,
  });
  useEffect(() => {
    if (
      ledger.error instanceof ApiError &&
      [403, 404].includes(ledger.error.status)
    )
      void onFailure(ledger.error);
  }, [ledger.error, onFailure]);
  return { api, ledger, currencies };
}

export function Expenses(props: Context & { active: boolean }) {
  const { trip, active } = props;
  const { ledger, currencies } = useFinance(props, active);
  const read = useApi();
  const activities = useQuery({
    queryKey: ["trip", trip.id, "activities", "expense-options"],
    enabled: active,
    retry: false,
    queryFn: async ({ signal }) => {
      const all: Activity[] = [];
      for (let offset = 0; ; offset += 100) {
        const page = await read<Activity[]>(
          `/api/v1/trips/${trip.id}/activities?limit=100&offset=${offset}`,
          { signal },
        );
        if (!page) throw new Error("Unable to load activities.");
        all.push(...page);
        if (page.length < 100) break;
      }
      return all.sort(
        (a, b) => a.starts_at.localeCompare(b.starts_at) || a.id - b.id,
      );
    },
  });
  if (!active) return null;
  const data = ledger.data;
  const money = (amount: string | bigint, currency: string) =>
    formatMoney(
      String(amount),
      currencies.data?.find((c) => c.code === currency) ?? {
        code: currency,
        decimals: 2,
      },
    );
  const historical = [
    ...new Map(
      [...(data?.expenses ?? []), ...(data?.loans ?? [])]
        .filter((e) => !e.activity_id)
        .map((e) => [
          activityKey(e),
          e.activity_name
            ? `${e.activity_name} (removed)`
            : "Unassigned expenses",
        ]),
    ).entries(),
  ];
  if (
    (data?.settlements.some((s) => !s.payment_id && !s.loan_id) ||
      !!data?.reversed_settlements?.length) &&
    !historical.some(([key]) => key === "unassigned")
  )
    historical.push(["unassigned", "Unassigned expenses"]);
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold">Activity expenses</h2>
        <p className="text-muted-foreground">
          Choose an activity to see costs and payments.
        </p>
      </div>
      {(ledger.isPending || activities.isPending || currencies.isPending) && (
        <p role="status">Loading activity expenses…</p>
      )}
      {(ledger.error || activities.error || currencies.error) && (
        <TripError
          error={ledger.error ?? activities.error ?? currencies.error}
          retry={() => {
            void ledger.refetch();
            void activities.refetch();
            void currencies.refetch();
          }}
        />
      )}
      {data && activities.data && currencies.data && (
        <>
          {!activities.data.length && (
            <p>
              No activities yet. Add an activity in the itinerary to start
              planning expenses.
            </p>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {activities.data.map((a) => {
              const costs = data.expenses.filter((e) => e.activity_id === a.id);
              const codes = [...new Set(costs.map((e) => e.currency))];
              return (
                <Link
                  key={a.id}
                  href={`/trips/${trip.id}?activity=${a.id}`}
                  scroll={false}
                  className="rounded-2xl border bg-card p-5 focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <h3 className="font-semibold break-words">{a.title}</h3>
                  {!costs.length ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No expenses yet
                    </p>
                  ) : (
                    codes.map((code) => {
                      const total = costs
                        .filter((e) => e.currency === code)
                        .reduce((n, e) => n + BigInt(e.amount_minor), 0n);
                      const own = personalTotals(
                        data,
                        props.current?.user_id ?? 0,
                        code,
                        String(a.id),
                      );
                      return (
                        <div key={code} className="mt-3 space-y-1 text-sm">
                          <p>
                            Total {money(total, code)} · My share{" "}
                            {money(own.cost, code)}
                          </p>
                          <p className="text-muted-foreground">
                            {own.remaining > 0n
                              ? `Still to pay ${money(own.remaining, code)}`
                              : "My share paid"}
                            {own.owed > 0n
                              ? ` · Owed to me ${money(own.owed, code)}`
                              : ""}
                          </p>
                        </div>
                      );
                    })
                  )}
                  <p className="mt-4 text-sm font-medium text-primary">
                    View activity →
                  </p>
                </Link>
              );
            })}
          </div>
          {historical.map(([key, title]) => (
            <details key={key} className="rounded-2xl border p-5">
              <summary className="cursor-pointer font-medium">{title}</summary>
              <ActivityExpenses
                {...props}
                activityID={key}
                activityTitle={title}
                activities={activities.data}
              />
            </details>
          ))}
        </>
      )}
    </section>
  );
}

export function ActivityExpenses(
  props: Context & {
    activityID: string;
    activityTitle: string;
    activities?: { id: number; title: string }[];
    autoAdd?: boolean;
    compact?: boolean;
    managementOnly?: boolean;
  },
) {
  const { trip, current, participants, activityID, activityTitle } = props;
  const hasActivity = Number(activityID) > 0;
  const { api, ledger, currencies } = useFinance(props);
  const params = useSearchParams();
  const auto = props.autoAdd || params.has("addCost");
  const isEditor = current?.role === "owner" || current?.role === "editor";
  const writable = !!current && current.role !== "viewer";
  const [editor, setEditor] = useState<ExpenseEditor | null>(null);
  const [paymentCost, setPaymentCost] = useState<Expense | null>(null);
  const [autoDismissed, setAutoDismissed] = useState(false);
  const editing =
    editor ??
    (auto && !autoDismissed && isEditor ? { type: "cost" as const } : null);
  const [dirty, setDirty] = useState(false);
  const [localError, setLocalError] = useState<Error | null>(null);
  const [history, setHistory] = useState<ReceiptHistory[] | null>(null);
  const [historyID, setHistoryID] = useState<number | null>(null);
  const [historyError, setHistoryError] = useState<Error | null>(null);
  const [revision, setRevision] = useState(0);
  const trigger = useRef<HTMLElement | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const key = useRef("");
  const data = ledger.data;
  const people = [
    ...new Map(
      [...(data?.people ?? []), ...(participants ?? [])].map((p) => [
        p.user_id,
        p,
      ]),
    ).values(),
  ];
  const name = (id: number) =>
    expenseName(people.find((p) => p.user_id === id));
  const money = (amount: string | bigint, currency: string) =>
    formatMoney(
      String(amount),
      currencies.data?.find((c) => c.code === currency) ?? {
        code: currency,
        decimals: 2,
      },
    );
  const costs =
    data?.expenses.filter((e) => activityKey(e) === activityID) ?? [];
  const codes = [...new Set(costs.map((e) => e.currency))];
  const hasOtherBalances =
    !!data &&
    (data.debts.some(
      (d) =>
        activityKey(d) === activityID &&
        d.loan_id &&
        BigInt(d.amount_minor) !== 0n,
    ) ||
      (activityID === "unassigned" &&
        data.settlements.some((s) => !s.payment_id && !s.loan_id)) ||
      !!data.reversed_settlements?.length);
  const options =
    props.activities ??
    (hasActivity ? [{ id: Number(activityID), title: activityTitle }] : []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function open(next: ExpenseEditor) {
    trigger.current = document.activeElement as HTMLElement;
    key.current = crypto.randomUUID();
    api.reset();
    setLocalError(null);
    setDirty(false);
    setEditor(next);
  }
  function close() {
    if (
      api.pending ||
      (dirty && !window.confirm("Discard unsaved expense changes?"))
    )
      return;
    setEditor(null);
    setAutoDismissed(true);
    setDirty(false);
    key.current = "";
    api.reset();
  }
  async function save(input: ExpenseInput | TransactionInput) {
    if (!editing || !writable)
      throw new Error("You no longer have permission to save.");
    if (!key.current) key.current = crypto.randomUUID();
    let saved: FinancialRecord | true | undefined;
    if (editing.type === "cost") {
      if (!isEditor) throw new Error("Only a planner/editor can manage costs.");
      saved = await api.saveExpense(
        input as ExpenseInput,
        editing.cost,
        key.current,
      );
    } else if (editing.type === "payment") {
      if (!isEditor)
        throw new Error("Only a planner/editor can confirm business payments.");
      saved = await api.saveTransaction(
        "expense_payments",
        input as TransactionInput,
        editing.payment,
        key.current,
      );
    } else if (editing.type === "repayment") {
      const value = input as TransactionInput;
      if (!editing.receipt && value.to_user_id !== current?.user_id)
        throw new Error("Only the recipient can confirm money received.");
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
    setDirty(false);
    key.current = "";
  }
  async function reverse(kind: LedgerKind, record: FinancialRecord) {
    const reason =
      kind === "settlements"
        ? window.prompt("Why are you reversing this receipt?")
        : undefined;
    if (kind === "settlements" && !reason?.trim()) return;
    if (!window.confirm("Reverse this recorded payment? Balances will change."))
      return;
    try {
      await api.remove(kind, record, reason ?? undefined);
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
  return (
    <section
      className={props.compact ? "activity-cost-section" : "space-y-4 pt-4"}
      aria-label={`Expenses for ${activityTitle}`}
    >
      {!props.managementOnly && (
        <div className="activity-cost-heading flex flex-wrap items-center justify-between gap-3">
          <h3 ref={heading} tabIndex={-1} className="text-xl font-semibold">
            Expenses
          </h3>
          {isEditor && hasActivity && (
            <Button onClick={() => open({ type: "cost" })}>Add expense</Button>
          )}
        </div>
      )}
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
          {!costs.length && (
            <p className="text-muted-foreground">
              No expenses yet.
              {isEditor
                ? " Add entrance fees, rooms, or other activity costs."
                : ""}
            </p>
          )}
          {!props.managementOnly &&
            codes.map((code) => {
              const total = costs
                .filter((e) => e.currency === code)
                .reduce((n, e) => n + BigInt(e.amount_minor), 0n);
              const own = personalTotals(
                data,
                current?.user_id ?? 0,
                code,
                activityID,
              );
              return (
                <div key={code} className="activity-cost-total">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Estimated total
                    </p>
                    <p className="text-xl font-semibold">
                      {money(total, code)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Your share</p>
                    <p className="text-xl font-semibold">
                      {money(own.cost, code)}
                    </p>
                  </div>
                </div>
              );
            })}
          <div className="activity-cost-list">
            {costs.map((cost) => {
              const payments = data.payments.filter(
                (p) => p.expense_id === cost.id,
              );
              const paid = payments.reduce(
                (n, p) => n + BigInt(p.amount_minor),
                0n,
              );
              const equal = cost.shares.every(
                (s) => s.amount_minor === cost.shares[0]?.amount_minor,
              );
              const receipts = data.settlements.filter((s) =>
                payments.some((p) => p.id === s.payment_id),
              );
              return (
                <article key={cost.id} className="space-y-2 py-5">
                  {!props.managementOnly && (
                    <>
                      <div className="activity-cost-title">
                        <h4 aria-label={cost.description}>
                          <button
                            type="button"
                            onClick={(event) => {
                              trigger.current = event.currentTarget;
                              setPaymentCost(cost);
                            }}
                            aria-label={`View ${cost.description} payments`}
                          >
                            {cost.description}
                          </button>
                        </h4>
                        <span>
                          {equal && cost.shares[0]
                            ? `${money(cost.shares[0].amount_minor, cost.currency)} each`
                            : money(cost.amount_minor, cost.currency)}
                        </span>
                      </div>
                      <p className="activity-cost-meta">
                        {cost.shares.length} people ·{" "}
                        {money(cost.amount_minor, cost.currency)} total
                      </p>
                      {!!cost.planned_coverer_user_id ? (
                        <p className="activity-cost-status">
                          {name(cost.planned_coverer_user_id)}{" "}
                          {paid > 0n ? "paid" : "will cover"} the{" "}
                          {money(
                            cost.planned_cover_amount_minor ?? "0",
                            cost.currency,
                          )}{" "}
                          reservation
                        </p>
                      ) : (
                        <p className="activity-cost-meta">
                          {paid > 0n
                            ? `${money(paid, cost.currency)} paid to ${cost.description}`
                            : "Not paid yet"}
                        </p>
                      )}
                      {
                        <Button
                          variant="outline"
                          className="activity-view-payments"
                          onClick={(event) => {
                            trigger.current = event.currentTarget;
                            setPaymentCost(cost);
                          }}
                        >
                          View payments
                        </Button>
                      }
                    </>
                  )}
                  {props.managementOnly && (
                    <h4 className="font-semibold">{cost.description}</h4>
                  )}
                  {!props.compact && (payments.length > 0 || isEditor) && (
                    <details>
                      <summary className="cursor-pointer text-sm text-muted-foreground py-2">
                        Payment history and corrections
                      </summary>
                      <div className="space-y-3 text-sm pt-2">
                        {isEditor && (
                          <Button
                            variant="link"
                            onClick={() => open({ type: "cost", cost })}
                            aria-label={`Edit ${cost.description} expense`}
                          >
                            Edit expense
                          </Button>
                        )}
                        {payments.map((p) => (
                          <div key={p.id}>
                            <p>
                              {name(p.payer_user_id)} paid{" "}
                              {money(p.amount_minor, p.currency)} to business ·{" "}
                              {p.paid_on}
                            </p>
                            {isEditor && (
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  variant="ghost"
                                  disabled={
                                    api.pending ||
                                    receipts.some((s) => s.payment_id === p.id)
                                  }
                                  onClick={() =>
                                    open({ type: "payment", cost, payment: p })
                                  }
                                >
                                  Correct payment
                                </Button>
                                <Button
                                  variant="ghost"
                                  disabled={
                                    api.pending ||
                                    receipts.some((s) => s.payment_id === p.id)
                                  }
                                  onClick={() =>
                                    void reverse("expense_payments", p)
                                  }
                                >
                                  Reverse payment
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                        {receipts.map((s) => (
                          <div key={`s${s.id}`}>
                            <p>
                              {name(s.to_user_id)} received{" "}
                              {money(s.amount_minor, s.currency)} from{" "}
                              {name(s.from_user_id)} · {s.paid_on}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="ghost"
                                onClick={() => void showHistory(s.id)}
                              >
                                Receipt history
                              </Button>
                              {canCorrect(s) && (
                                <>
                                  <Button
                                    variant="ghost"
                                    onClick={() =>
                                      open({
                                        type: "repayment",
                                        receipt: s,
                                        debt: debtFor(s),
                                      })
                                    }
                                  >
                                    Correct receipt
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    disabled={api.pending}
                                    onClick={() =>
                                      void reverse("settlements", s)
                                    }
                                  >
                                    Reverse receipt
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                        {isEditor && !payments.length && (
                          <Button
                            variant="ghost"
                            disabled={api.pending}
                            onClick={() => void reverse("expenses", cost)}
                          >
                            Remove expense
                          </Button>
                        )}
                      </div>
                    </details>
                  )}
                </article>
              );
            })}
          </div>
          {!props.compact && hasOtherBalances && (
            <details>
              <summary className="min-h-11 cursor-pointer text-sm">
                Other balances and historical receipts
              </summary>
              <div className="space-y-3 text-sm">
                {data.debts
                  .filter(
                    (d) =>
                      activityKey(d) === activityID &&
                      d.loan_id &&
                      BigInt(d.amount_minor) !== 0n,
                  )
                  .map((d) => (
                    <div key={`loan${d.loan_id}`}>
                      <p>
                        {name(d.from_user_id)} owes {name(d.to_user_id)}{" "}
                        {money(d.amount_minor, d.currency)} · {d.description}
                      </p>
                      {writable &&
                        current?.user_id === d.to_user_id &&
                        BigInt(d.amount_minor) > 0n && (
                          <Button
                            onClick={() => open({ type: "repayment", debt: d })}
                          >
                            Mark received
                          </Button>
                        )}
                    </div>
                  ))}
                {activityID === "unassigned" &&
                  data.settlements
                    .filter((s) => !s.payment_id && !s.loan_id)
                    .map((s) => (
                      <div key={s.id}>
                        <p>
                          {name(s.from_user_id)} → {name(s.to_user_id)} ·{" "}
                          {money(s.amount_minor, s.currency)} · Trip-level
                          receipt awaiting association
                        </p>
                        {isEditor && (
                          <Button
                            variant="outline"
                            onClick={() =>
                              open({ type: "repayment", receipt: s })
                            }
                          >
                            Associate existing receipt
                          </Button>
                        )}
                      </div>
                    ))}
                {(data.reversed_settlements ?? []).map((s) => (
                  <div key={`reversed-${s.id}`} className="border-t pt-3">
                    <p>
                      Reversed receipt: {name(s.from_user_id)} →{" "}
                      {name(s.to_user_id)} · {money(s.amount_minor, s.currency)}
                    </p>
                    <Button
                      variant="ghost"
                      onClick={() => void showHistory(s.id)}
                    >
                      Receipt history
                    </Button>
                  </div>
                ))}
                <p className="text-muted-foreground">
                  These records remain part of the trip’s balances.
                </p>
              </div>
            </details>
          )}
          {current?.role === "viewer" && (
            <p className="text-sm text-muted-foreground">Read-only access</p>
          )}
        </>
      )}
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
          onFailure={props.onFailure}
        />
      )}
      {editing?.type === "cost" && hasActivity && currencies.data && (
        <ExpenseCostEditor
          tripID={trip.id}
          key={`${revision}-${editing.cost?.id ?? "new"}`}
          activity={{
            id: Number(activityID) || undefined,
            title: activityTitle,
          }}
          initial={editing.cost}
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
                  setDirty(false);
                  api.reset();
                }
              : undefined
          }
          onBack={() => {
            setDirty(false);
            setEditor(null);
            setAutoDismissed(true);
          }}
          onDirty={() => {
            setDirty(true);
            api.reset();
          }}
        />
      )}
      <TripDialog
        className="expense-editor-dialog"
        backdropClassName="bg-black/60"
        open={!!editing && (editing.type !== "cost" || !hasActivity)}
        title={
          editing?.type === "cost"
            ? editing.cost
              ? "Edit expense"
              : "Add expense"
            : editing?.type === "payment"
              ? "Record business payment"
              : editing?.receipt
                ? "Correct receipt"
                : "Mark received"
        }
        description={activityTitle}
        busy={api.pending}
        disablePointerDismissal
        finalFocus={() =>
          trigger.current?.isConnected ? trigger.current : heading.current
        }
        onOpenChange={(value) => {
          if (!value) close();
        }}
      >
        {editing &&
          (editing.type !== "cost" || !hasActivity) &&
          data &&
          currencies.data &&
          current && (
            <>
              <ActivityExpenseForm
                key={`${revision}-${editing.type}-${editing.cost?.id ?? "new"}-${editing.memberID ?? ""}-${editing.payment?.id ?? ""}-${editing.receipt?.id ?? ""}-${editing.debt?.payment_id ?? editing.debt?.loan_id ?? ""}-${editing.debt?.from_user_id ?? ""}`}
                editor={editing}
                activityID={activityID}
                activities={options}
                people={people}
                currencies={currencies.data}
                userID={current.user_id}
                currentUserIDs={participants?.map((p) => p.user_id)}
                zone={trip.time_zone}
                ledger={data}
                pending={api.pending || !writable}
                error={api.error}
                onDirty={() => {
                  setDirty(true);
                  if (!editor) setEditor(editing);
                }}
                onSave={save}
                onCancel={close}
              />
              {localError && <TripError error={localError} />}
              {api.error instanceof ApiError && api.error.status === 409 && (
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (
                      !window.confirm(
                        "Discard this draft and load the latest record?",
                      )
                    )
                      return;
                    try {
                      if (editing.cost) {
                        const latest = await api.get(
                          "expenses",
                          editing.cost.id,
                        );
                        setEditor({
                          ...editing,
                          cost: latest as typeof editing.cost,
                        });
                      }
                      if (editing.payment) {
                        const latest = await api.get(
                          "expense_payments",
                          editing.payment.id,
                        );
                        setEditor({
                          ...editing,
                          payment: latest as typeof editing.payment,
                        });
                      }
                      if (editing.receipt) {
                        const latest = await api.get(
                          "settlements",
                          editing.receipt.id,
                        );
                        setEditor({
                          ...editing,
                          receipt: latest as typeof editing.receipt,
                        });
                      }
                      await api.refresh();
                      setRevision((n) => n + 1);
                      setDirty(false);
                      api.reset();
                    } catch (cause) {
                      setLocalError(cause as Error);
                    }
                  }}
                >
                  Reload latest record
                </Button>
              )}
            </>
          )}
      </TripDialog>
      <TripDialog
        open={historyID !== null}
        title="Receipt history"
        description="Who recorded or corrected this receipt"
        onOpenChange={(open) => {
          if (!open) setHistoryID(null);
        }}
      >
        <div className="space-y-4">
          {historyError ? (
            <TripError
              error={historyError}
              retry={() => void showHistory(historyID!)}
            />
          ) : history === null ? (
            <p role="status">Loading receipt history…</p>
          ) : history.length ? (
            history.map((h) => (
              <div key={h.id} className="border-b pb-3 text-sm">
                <p>
                  {h.action} by {name(h.actor_user_id)} ·{" "}
                  {new Date(h.created_at).toLocaleString()}
                </p>
                {h.reason && <p>{h.reason}</p>}
                <p>
                  {h.before
                    ? money(h.before.amount_minor, h.before.currency)
                    : "No previous receipt"}{" "}
                  →{" "}
                  {h.after
                    ? money(h.after.amount_minor, h.after.currency)
                    : "Reversed"}
                </p>
              </div>
            ))
          ) : (
            <p>No earlier changes recorded for this historical receipt.</p>
          )}
        </div>
      </TripDialog>
    </section>
  );
}
