"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CaretDownIcon, CaretRightIcon, PlusIcon } from "@phosphor-icons/react";
import { useFinance } from "@/components/features/expenses/use-finance";
import { DeletePrepTaskDialog } from "@/components/features/prep/dialogs/delete-prep-task-dialog";
import { PrepTaskDialog } from "@/components/features/prep/dialogs/prep-task-dialog";
import { TaskDetailsDrawer } from "@/components/features/prep/drawers/task-details-drawer";
import { prepChipClass } from "@/components/features/prep/prep-select";
import {
  PrepTaskRow,
  type PrepRowOpen,
} from "@/components/features/prep/prep-task-row";
import { TripError } from "@/components/shared/trip-states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { dateLabel, localDate } from "@/lib/activity-time";
import { ApiError } from "@/lib/api";
import type { Participant } from "@/lib/memberships";
import { moneyIn } from "@/lib/money";
import {
  isTaskDone,
  prepByActivity,
  prepKey,
  prepSections,
  takesPart,
  totalsByCurrency,
  usePrepApi,
  type PrepTask,
} from "@/lib/prep";
import type { Trip } from "@/lib/trips";

type Editing = { mode: "add" } | { mode: "edit" | "delete"; task: PrepTask };
type View = "all" | "you" | "activity";
const views: { value: View; label: string }[] = [
  { value: "all", label: "All" },
  { value: "you", label: "For you" },
  { value: "activity", label: "By activity" },
];
const rowFocus = (id: number) =>
  document.getElementById(`prep-task-${id}`) ??
  document.getElementById("prep-heading");

export function Prep({
  trip,
  participants,
  current,
  canEdit,
  onFailure,
}: {
  trip: Trip;
  participants?: Participant[];
  current?: Participant;
  canEdit: boolean;
  onFailure: (error: Error) => void | Promise<void>;
}) {
  const api = usePrepApi(trip.id, onFailure);
  const tasks = useQuery({
    queryKey: prepKey(trip.id),
    queryFn: ({ signal }) => api.list(signal),
    retry: false,
  });
  // Expenses only add amounts to rows; if they fail, Prep still works.
  const { ledger, currencies } = useFinance({
    trip,
    participants,
    current,
    onFailure,
  });
  const [view, setView] = useState<View>("all");
  const [doneOpen, setDoneOpen] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [details, setDetails] = useState<number | null>(null);
  const [notice, setNotice] = useState<Error | null>(null);
  const addTrigger = useRef<HTMLElement | null>(null);
  const acted = useRef<number | null>(null);

  useEffect(() => {
    if (
      tasks.error instanceof ApiError &&
      [403, 404].includes(tasks.error.status)
    )
      void onFailure(tasks.error);
  }, [tasks.error, onFailure]);

  // An action can move its row or replace the focused button. Once the new list
  // has rendered, put keyboard focus back on the row if it was lost.
  useEffect(() => {
    const id = acted.current;
    if (id === null) return;
    acted.current = null;
    if (document.activeElement && document.activeElement !== document.body)
      return;
    rowFocus(id)?.focus();
  }, [tasks.dataUpdatedAt]);

  const people = (participants ?? []).filter(takesPart);
  const list = tasks.data ?? [];
  const me = current?.user_id;
  const detailTask = list.find((task) => task.id === details);
  const open = (next: Editing | null) => {
    api.reset();
    setEditing(next);
  };
  const add = (event: { currentTarget: HTMLElement }) => {
    addTrigger.current = event.currentTarget;
    open({ mode: "add" });
  };
  const close = () => open(null);
  const finalFocus = () =>
    editing && "task" in editing
      ? rowFocus(editing.task.id)
      : addTrigger.current;
  const onOpen = (task: PrepTask, mode: PrepRowOpen) => {
    if (mode === "details") return setDetails(task.id);
    setDetails(null);
    open({ mode, task });
  };
  const costs = (task: PrepTask) =>
    ledger.data?.expenses.filter((e) => e.prep_task_id === task.id) ?? [];
  const money = moneyIn(currencies.data ?? []);
  const amounts = (task: PrepTask) =>
    totalsByCurrency(costs(task))
      .map((t) => money(t.amount_minor, t.currency))
      .join(" · ") || undefined;
  const row = (task: PrepTask, byActivity = false) => (
    <PrepTaskRow
      key={task.id}
      task={task}
      current={current}
      canEdit={canEdit}
      byActivity={byActivity}
      amounts={amounts(task)}
      onFailure={onFailure}
      onAction={(id) => {
        acted.current = id;
        setNotice(null);
      }}
      onActionError={setNotice}
      onOpen={(mode) => onOpen(task, mode)}
    />
  );
  const group = (
    id: string,
    title: string | null,
    items: PrepTask[],
    byActivity = false,
  ) =>
    items.length > 0 && (
      <section
        key={id}
        aria-labelledby={title ? id : undefined}
        className="space-y-2"
      >
        {title && (
          <h3 id={id} className="font-semibold break-words">
            {title}
          </h3>
        )}
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {items.map((task) => row(task, byActivity))}
        </ul>
      </section>
    );
  const sections = prepSections(list, me);
  const byActivity = prepByActivity(list);
  const doneCount = list.filter(isTaskDone).length;

  return (
    <section className="space-y-6" aria-labelledby="prep-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <h2
            id="prep-heading"
            tabIndex={-1}
            className="text-[1.375rem] leading-7 font-semibold outline-none"
          >
            Prep
          </h2>
          {list.length > 0 && (
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">
                {doneCount} of {list.length} done
              </p>
              <div
                role="progressbar"
                aria-label="Prep progress"
                aria-valuemin={0}
                aria-valuemax={list.length}
                aria-valuenow={doneCount}
                className="h-1 w-30 overflow-hidden rounded-full bg-muted md:w-40"
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(doneCount / list.length) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
        {canEdit && tasks.isSuccess && (
          <Button className="hidden min-h-11 md:inline-flex" onClick={add}>
            <PlusIcon aria-hidden="true" />
            Add task
          </Button>
        )}
      </div>
      {current?.role === "viewer" && (
        <p className="text-sm text-muted-foreground">
          You&apos;re viewing this list. Viewers aren&apos;t counted and
          can&apos;t take tasks.
        </p>
      )}
      {notice && <TripError error={notice} />}
      {tasks.isPending ? (
        <div role="status" className="space-y-3">
          <span className="sr-only">Loading prep tasks…</span>
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : tasks.isError && !tasks.data ? (
        <TripError
          error={tasks.error}
          retry={() => void tasks.refetch()}
          pending={tasks.isFetching}
        />
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card px-5 py-8 text-center">
          <p className="font-semibold">Nothing to prepare yet</p>
          <p className="max-w-70 text-sm text-muted-foreground">
            {canEdit
              ? "Add the first thing your group needs to sort out."
              : "Tasks will appear here when an editor adds them."}
          </p>
          {canEdit && (
            <Button variant="outline" className="min-h-11" onClick={add}>
              <PlusIcon aria-hidden="true" />
              Add task
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
            {views.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant="ghost"
                className={prepChipClass}
                aria-pressed={view === option.value}
                onClick={() => setView(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          {view === "you" ? (
            sections.forYou.length ? (
              group("prep-for-you", null, sections.forYou)
            ) : (
              <p className="rounded-2xl border bg-card px-5 py-6 text-center text-sm text-muted-foreground">
                Nothing waits on you right now.
              </p>
            )
          ) : view === "activity" ? (
            <>
              {byActivity.activities.map(({ activity, tasks }) =>
                group(
                  `prep-activity-${activity.id}`,
                  `${activity.title} · ${dateLabel(localDate(activity.starts_at, trip.time_zone))}`,
                  tasks,
                  true,
                ),
              )}
              {group(
                "prep-whole-trip",
                "Whole trip",
                byActivity.wholeTrip,
                true,
              )}
              {!byActivity.activities.length &&
                !byActivity.wholeTrip.length && (
                  <p className="rounded-2xl border bg-card px-5 py-6 text-center text-sm text-muted-foreground">
                    Everything is done.
                  </p>
                )}
            </>
          ) : (
            <>
              {group("prep-for-you", "For you", sections.forYou)}
              {group("prep-up-for-grabs", "Up for grabs", sections.upForGrabs)}
              {group("prep-with-others", "With others", sections.withOthers)}
              {sections.done.length > 0 && (
                <section className="space-y-2">
                  <Button
                    variant="ghost"
                    className="-ml-3 min-h-11 font-semibold text-muted-foreground"
                    aria-expanded={doneOpen}
                    aria-controls="prep-done"
                    onClick={() => setDoneOpen((value) => !value)}
                  >
                    {doneOpen ? (
                      <CaretDownIcon aria-hidden="true" />
                    ) : (
                      <CaretRightIcon aria-hidden="true" />
                    )}
                    Done · {sections.done.length}
                  </Button>
                  {doneOpen && (
                    <ul
                      id="prep-done"
                      className="divide-y overflow-hidden rounded-2xl border bg-card"
                    >
                      {sections.done.map((task) => row(task))}
                    </ul>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      )}
      {canEdit && tasks.isSuccess && (
        <div className="mobile-add-activity fixed right-[max(1.5rem,env(safe-area-inset-right,0px))] bottom-[var(--app-bottom)] z-30 md:hidden">
          <Button className="min-h-12" onClick={add}>
            <PlusIcon aria-hidden="true" />
            Add task
          </Button>
        </div>
      )}
      {detailTask && (
        <TaskDetailsDrawer
          key={detailTask.id}
          task={detailTask}
          trip={trip}
          participants={participants}
          current={current}
          canEdit={canEdit}
          onFailure={onFailure}
          onAction={(id) => {
            acted.current = id;
          }}
          onOpen={(mode) => onOpen(detailTask, mode)}
          onClose={() => setDetails(null)}
          finalFocus={() => rowFocus(detailTask.id)}
        />
      )}
      {(editing?.mode === "add" || editing?.mode === "edit") && (
        <PrepTaskDialog
          api={api}
          trip={trip}
          task={editing.mode === "edit" ? editing.task : undefined}
          people={people}
          current={current}
          finalFocus={finalFocus}
          onClose={close}
        />
      )}
      {editing?.mode === "delete" && (
        <DeletePrepTaskDialog
          api={api}
          task={editing.task}
          expenses={costs(editing.task).length}
          finalFocus={finalFocus}
          onClose={close}
        />
      )}
    </section>
  );
}
