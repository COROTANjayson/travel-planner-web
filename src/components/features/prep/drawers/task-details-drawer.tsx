"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  CalendarDotsIcon,
  CheckCircleIcon,
  CircleIcon,
  PencilSimpleIcon,
  PlusIcon,
  UserIcon,
  UsersIcon,
} from "@phosphor-icons/react";
import { taskMenuItems } from "@/components/features/prep/prep-task-row";
import { ExpenseCostEditor } from "@/components/features/expenses/drawers/cost-editor/expense-cost-editor";
import { ExpensePaymentWorkspace } from "@/components/features/expenses/drawers/payment-workspace/expense-payment-workspace";
import { useFinance } from "@/components/features/expenses/use-finance";
import { OptionsMenu } from "@/components/shared/options-menu";
import { TripDialog } from "@/components/shared/trip-dialog";
import { TripError } from "@/components/shared/trip-states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { memberPaymentState } from "@/lib/activity-expenses";
import { dateLabel, localDate } from "@/lib/activity-time";
import { ApiError } from "@/lib/api";
import { tripPeople, type Expense, type ExpenseInput } from "@/lib/expenses";
import { participantName, type Participant } from "@/lib/memberships";
import { moneyIn } from "@/lib/money";
import {
  isTaskDone,
  takesPart,
  totalsByCurrency,
  usePrepApi,
  type PrepTask,
} from "@/lib/prep";
import type { Trip } from "@/lib/trips";

/**
 * A prep task's details: who's on it, its day or activity, its expenses, and
 * the one action you can take. Expense flows open over the drawer and return
 * to it.
 */
export function TaskDetailsDrawer({
  task,
  trip,
  participants,
  current,
  canEdit,
  onFailure,
  onAction,
  onOpen,
  onClose,
  finalFocus,
}: {
  task: PrepTask;
  trip: Trip;
  participants?: Participant[];
  current?: Participant;
  canEdit: boolean;
  onFailure: (error: Error) => void | Promise<void>;
  onAction: (id: number) => void;
  onOpen: (mode: "edit" | "delete") => void;
  onClose: () => void;
  finalFocus: () => HTMLElement | null;
}) {
  const api = usePrepApi(trip.id, onFailure);
  const {
    api: finance,
    ledger,
    currencies,
  } = useFinance({
    trip,
    participants,
    current,
    onFailure,
  });
  const [editing, setEditing] = useState<{ cost?: Expense } | null>(null);
  const [paying, setPaying] = useState<Expense | null>(null);
  const [revision, setRevision] = useState(0);
  const key = useRef("");
  const trigger = useRef<HTMLElement | null>(null);
  const heading = useRef<HTMLDivElement>(null);
  const active = takesPart(current);
  const me = current?.user_id;
  const everyone = task.kind === "everyone";
  const mine = me !== undefined && task.assignee?.user_id === me;
  const done = isTaskDone(task);
  const viewer = current?.role === "viewer";
  // Everyone tasks list each person with a tick: you first, then by name, so
  // rows don't jump when someone ticks.
  const ready = task.ready_user_ids;
  const checklist = [...ready, ...task.waiting_user_ids]
    .map((id) => {
      const person = participants?.find((p) => p.user_id === id);
      return {
        id,
        name: person ? participantName(person) : "Traveler",
        done: ready.includes(id),
      };
    })
    .sort(
      (a, b) =>
        Number(b.id === me) - Number(a.id === me) ||
        a.name.localeCompare(b.name),
    );
  const who = done
    ? everyone
      ? "Everyone's done"
      : `Done by ${mine ? "you" : task.assignee ? participantName(task.assignee) : "a former traveler"}`
    : everyone
      ? `${ready.length} of ${checklist.length} done`
      : mine
        ? "You're on it"
        : task.assignee
          ? `${participantName(task.assignee)} is on it`
          : "Up for grabs";
  const WhoIcon = done ? CheckCircleIcon : everyone ? UsersIcon : UserIcon;
  const action = !active
    ? null
    : everyone
      ? me !== undefined && task.waiting_user_ids.includes(me)
        ? { label: "Mark my part done", run: () => api.complete(task.id) }
        : null
      : mine && !task.completed_at
        ? { label: "Mark done", run: () => api.complete(task.id) }
        : !task.assignee && !task.completed_at
          ? { label: "Claim", run: () => api.claim(task.id), outline: true }
          : null;

  const costs =
    ledger.data?.expenses.filter((e) => e.prep_task_id === task.id) ?? [];
  const currency = (code: string) =>
    currencies.data?.find((c) => c.code === code) ?? { code, decimals: 2 };
  const money = moneyIn(currencies.data ?? []);
  const people = tripPeople(ledger.data?.people, participants);
  const isEditor = current?.role === "owner" || current?.role === "editor";

  function openCost(cost?: Expense) {
    trigger.current = document.activeElement as HTMLElement;
    key.current = crypto.randomUUID();
    finance.reset();
    setEditing({ cost });
  }
  async function save(input: ExpenseInput) {
    if (!isEditor)
      throw new ApiError(403, "Only a planner/editor can manage costs.");
    if (!key.current) key.current = crypto.randomUUID();
    const saved = await finance.saveExpense(input, editing?.cost, key.current);
    if (saved) {
      key.current = "";
      setEditing(null);
    }
  }
  const back = () =>
    trigger.current?.isConnected ? trigger.current : heading.current;

  return (
    <>
      <TripDialog
        open
        presentation="detail"
        mobilePresentation="tall-sheet"
        variant="reference"
        className="activity-details-dialog"
        backLabel="Back to prep"
        onBack={onClose}
        title={task.title}
        titleAction={
          canEdit && (
            <OptionsMenu
              name={task.title}
              description={who}
              items={taskMenuItems(
                task,
                onOpen,
                () =>
                  void api.reopen(task.id).then(
                    () => onAction(task.id),
                    () => {},
                  ),
              )}
            />
          )
        }
        busy={api.pending}
        finalFocus={finalFocus}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        footer={
          action && (
            <Button
              className="w-full md:w-auto md:self-end"
              variant={action.outline ? "outline" : "default"}
              disabled={api.pending}
              onClick={() =>
                void action.run().then(
                  () => onAction(task.id),
                  () => {},
                )
              }
            >
              {api.pending ? "Saving…" : action.label}
            </Button>
          )
        }
      >
        <div ref={heading} tabIndex={-1} className="space-y-5 outline-none">
          <div className="space-y-1.5 text-sm">
            <p className="flex items-start gap-2.5">
              <WhoIcon
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              />
              <span className="min-w-0 break-words">{who}</span>
            </p>
            <p className="flex items-start gap-2.5">
              <CalendarDotsIcon
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              />
              {task.activity ? (
                <Link
                  href={`/trips/${trip.id}?activity=${task.activity.id}`}
                  className="min-w-0 break-words text-primary underline-offset-2 hover:underline"
                >
                  {task.activity.title} ·{" "}
                  {dateLabel(
                    localDate(task.activity.starts_at, trip.time_zone),
                  )}
                </Link>
              ) : (
                <span className="min-w-0 break-words text-muted-foreground">
                  Whole trip ·{" "}
                  {task.date ? dateLabel(task.date) : "no activity"}
                </span>
              )}
            </p>
            {viewer && (
              <p className="text-[0.8125rem] text-muted-foreground">
                You&apos;re viewing this trip. Viewers can&apos;t take tasks or
                add costs.
              </p>
            )}
            {api.error && <TripError error={api.error} />}
          </div>
          {everyone && checklist.length > 0 && (
            <section aria-labelledby="task-people" className="space-y-2">
              <h3
                id="task-people"
                className="text-[0.8125rem] font-semibold text-muted-foreground"
              >
                Who&apos;s done
              </h3>
              <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
                {checklist.map((person) => (
                  <li
                    key={person.id}
                    className="flex min-h-12 items-center gap-3 px-4 py-2.5 text-sm"
                  >
                    {person.done ? (
                      <CheckCircleIcon
                        weight="fill"
                        aria-hidden="true"
                        className="size-5 shrink-0 text-primary"
                      />
                    ) : (
                      <CircleIcon
                        aria-hidden="true"
                        className="size-5 shrink-0 text-muted-foreground"
                      />
                    )}
                    <span className="min-w-0 flex-1 break-words">
                      {person.name}
                      {person.id === me && (
                        <span className="text-muted-foreground"> (you)</span>
                      )}
                    </span>
                    <span
                      className={`shrink-0 text-[0.8125rem] ${person.done ? "font-semibold text-primary" : "text-muted-foreground"}`}
                    >
                      {person.done ? "Done" : "Not yet"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section aria-labelledby="task-expenses" className="space-y-2">
            <div className="flex min-h-8 items-center gap-2">
              <h3
                id="task-expenses"
                className="flex-1 text-[0.8125rem] font-semibold text-muted-foreground"
              >
                Expenses
              </h3>
              {isEditor && (
                <Button
                  variant="link"
                  size="sm"
                  className="min-h-11 px-0"
                  disabled={!ledger.data || !currencies.data}
                  onClick={() => openCost()}
                >
                  <PlusIcon aria-hidden="true" />
                  Add expense
                </Button>
              )}
            </div>
            {ledger.isPending || currencies.isPending ? (
              <div role="status">
                <span className="sr-only">Loading expenses…</span>
                <Skeleton className="h-16 w-full rounded-2xl" />
              </div>
            ) : ledger.error || currencies.error ? (
              <div className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3">
                <p className="flex-1 text-sm text-destructive">
                  Expenses couldn&apos;t load.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={ledger.isFetching || currencies.isFetching}
                  onClick={() => {
                    void ledger.refetch();
                    void currencies.refetch();
                  }}
                >
                  Try again
                </Button>
              </div>
            ) : costs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {isEditor && !done
                  ? "No costs yet. Add one when you book."
                  : "No costs yet."}
              </p>
            ) : (
              <>
                <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
                  {costs.map((cost) => {
                    const state =
                      me !== undefined && ledger.data
                        ? memberPaymentState(cost, ledger.data, me)
                        : null;
                    const included = cost.shares.some((s) => s.user_id === me);
                    return (
                      <li key={cost.id} className="flex items-center pr-1">
                        <button
                          type="button"
                          className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
                          onClick={(event) => {
                            trigger.current = event.currentTarget;
                            setPaying(cost);
                          }}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold break-words">
                              {cost.description}
                            </span>
                            <span className="block text-[0.8125rem] text-muted-foreground">
                              {cost.shares.length}{" "}
                              {cost.shares.length === 1 ? "person" : "people"} ·
                              Total {money(cost.amount_minor, cost.currency)}
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block font-semibold">
                              {included && state
                                ? money(state.share.toString(), cost.currency)
                                : "—"}
                            </span>
                            <span className="block text-[0.8125rem] font-semibold text-muted-foreground">
                              {included && state
                                ? state.status
                                : "Not included"}
                            </span>
                          </span>
                        </button>
                        {isEditor && (
                          // Top-aligned with the title, and no hover fill: a filled
                          // circle doesn't sit well in the card's rounded corner.
                          <Button
                            variant="ghost"
                            className="size-11 shrink-0 self-start text-muted-foreground hover:bg-transparent hover:text-primary aria-expanded:bg-transparent dark:hover:bg-transparent"
                            aria-label={`Edit ${cost.description}`}
                            onClick={() => openCost(cost)}
                          >
                            <PencilSimpleIcon aria-hidden="true" />
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <p className="flex gap-3 pt-1 text-sm">
                  <span className="flex-1 text-muted-foreground">
                    Task total
                  </span>
                  <span className="text-right font-semibold">
                    {totalsByCurrency(costs)
                      .map((t) => money(t.amount_minor, t.currency))
                      .join(" · ")}
                  </span>
                </p>
                {task.activity && (
                  <p className="text-[0.8125rem] text-muted-foreground">
                    Also part of {task.activity.title}.
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      </TripDialog>
      {editing && currencies.data && (
        <ExpenseCostEditor
          key={`${revision}-${editing.cost?.id ?? "new"}`}
          tripID={trip.id}
          activity={{
            id: task.activity?.id,
            title: task.activity?.title ?? "",
          }}
          prepTask={{ id: task.id, title: task.title }}
          backLabel="Back to task"
          initial={editing.cost}
          people={people.filter(
            (p) =>
              editing.cost?.shares.some((s) => s.user_id === p.user_id) ||
              !participants ||
              participants.some((m) => m.user_id === p.user_id && takesPart(m)),
          )}
          currencies={currencies.data}
          zone={trip.time_zone}
          pending={finance.pending || !isEditor}
          error={finance.error}
          finalFocus={back}
          onSave={save}
          onReload={
            editing.cost
              ? async () => {
                  const latest = await finance.get<Expense>(
                    "expenses",
                    editing.cost!.id,
                  );
                  setEditing({ cost: latest });
                  setRevision((n) => n + 1);
                  finance.reset();
                }
              : undefined
          }
          onBack={() => {
            if (finance.pending) return;
            key.current = "";
            finance.reset();
            setEditing(null);
          }}
        />
      )}
      {paying && (
        <ExpensePaymentWorkspace
          trip={trip}
          participants={participants}
          cost={ledger.data?.expenses.find((c) => c.id === paying.id) ?? paying}
          currency={currency(paying.currency)}
          current={current}
          finalFocus={back}
          onBack={() => setPaying(null)}
          backLabel="Back to task"
          onFailure={onFailure}
        />
      )}
    </>
  );
}
