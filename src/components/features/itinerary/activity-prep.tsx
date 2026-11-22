"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CaretRightIcon,
  ListChecksIcon,
  PlusIcon,
} from "@phosphor-icons/react";
import { useFinance } from "@/components/features/expenses/use-finance";
import { AddFromPrepDialog } from "@/components/features/itinerary/dialogs/add-from-prep-dialog";
import { RemoveFromActivityDialog } from "@/components/features/itinerary/dialogs/remove-from-activity-dialog";
import { DeletePrepTaskDialog } from "@/components/features/prep/dialogs/delete-prep-task-dialog";
import { PrepTaskDialog } from "@/components/features/prep/dialogs/prep-task-dialog";
import { TaskDetailsDrawer } from "@/components/features/prep/drawers/task-details-drawer";
import {
  PrepTaskRow,
  type PrepRowOpen,
} from "@/components/features/prep/prep-task-row";
import { OptionsMenu } from "@/components/shared/options-menu";
import { TripError } from "@/components/shared/trip-states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Activity } from "@/lib/itinerary";
import type { Participant } from "@/lib/memberships";
import { moneyIn } from "@/lib/money";
import {
  isTaskDone,
  prepKey,
  takesPart,
  totalsByCurrency,
  usePrepApi,
  type PrepTask,
} from "@/lib/prep";
import type { Trip } from "@/lib/trips";

type Editing =
  | { mode: "add" | "from-prep" }
  | { mode: "edit" | "delete" | "remove"; task: PrepTask };

const headingFocus = () => document.getElementById("activity-prep-heading");
const rowFocus = (id: number) =>
  document.getElementById(`prep-task-${id}`) ?? headingFocus();

/**
 * Prep inside an activity (Figma "Activity details"): open tasks, with done
 * ones folded into one row. Owners and editors add a new task here or move a
 * trip-wide one in, with its expenses.
 */
export function ActivityPrep({
  trip,
  activity,
  participants,
  current,
  canEdit,
  onFailure,
}: {
  trip: Trip;
  activity: Activity;
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
  const [doneOpen, setDoneOpen] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [details, setDetails] = useState<number | null>(null);
  const [notice, setNotice] = useState<Error | null>(null);
  const addTrigger = useRef<HTMLButtonElement>(null);

  const all = tasks.data ?? [];
  const list = all.filter((task) => task.activity?.id === activity.id);
  const open = list.filter((task) => !isTaskDone(task));
  const done = list.filter(isTaskDone);
  const tripWide = all.filter((task) => !task.activity && !isTaskDone(task));
  const people = (participants ?? []).filter(takesPart);
  const detailTask = list.find((task) => task.id === details);

  const costs = (task: PrepTask) =>
    ledger.data?.expenses.filter((e) => e.prep_task_id === task.id) ?? [];
  const money = moneyIn(currencies.data ?? []);
  const amounts = (task: PrepTask) =>
    totalsByCurrency(costs(task))
      .map((t) => money(t.amount_minor, t.currency))
      .join(" · ") || undefined;

  const start = (next: Editing | null) => {
    api.reset();
    setEditing(next);
  };
  const close = () => start(null);
  const finalFocus = () =>
    editing && "task" in editing
      ? rowFocus(editing.task.id)
      : addTrigger.current;
  const onOpen = (task: PrepTask, mode: PrepRowOpen) => {
    if (mode === "details") return setDetails(task.id);
    setDetails(null);
    start({ mode, task });
  };
  const row = (task: PrepTask) => (
    <PrepTaskRow
      key={task.id}
      task={task}
      current={current}
      canEdit={canEdit}
      inActivity
      amounts={amounts(task)}
      onFailure={onFailure}
      onAction={() => setNotice(null)}
      onActionError={setNotice}
      onOpen={(mode) => onOpen(task, mode)}
    />
  );
  return (
    <section aria-labelledby="activity-prep-heading" className="space-y-2 pb-7">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <h3
          id="activity-prep-heading"
          tabIndex={-1}
          className="text-[13px] leading-[21px] font-semibold text-muted-foreground outline-none"
        >
          Prep
        </h3>
        {canEdit && tasks.isSuccess && (
          <OptionsMenu
            name="Add a prep task"
            description={activity.title}
            trigger={
              <Button
                ref={addTrigger}
                variant="link"
                size="sm"
                // Drawn at Figma's 28px; the invisible ::before keeps a 44px tap target.
                className="relative before:absolute before:inset-x-0 before:-inset-y-2 before:content-['']"
              />
            }
            triggerContent={
              <>
                <PlusIcon aria-hidden="true" />
                Add task
              </>
            }
            items={[
              {
                label: "New task",
                detail: "Something this activity needs",
                icon: <PlusIcon aria-hidden="true" />,
                onClick: () => start({ mode: "add" }),
              },
              {
                label: "From Prep",
                detail: "Move a trip-wide task here, with its expenses",
                icon: <ListChecksIcon aria-hidden="true" />,
                onClick: () => start({ mode: "from-prep" }),
              },
            ]}
          />
        )}
      </div>
      {notice && <TripError error={notice} />}
      {tasks.isPending ? (
        <div role="status">
          <span className="sr-only">Loading prep tasks…</span>
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      ) : tasks.isError && !tasks.data ? (
        <TripError
          error={tasks.error}
          retry={() => void tasks.refetch()}
          pending={tasks.isFetching}
        />
      ) : list.length === 0 ? (
        <p className="text-sm leading-5 text-muted-foreground">
          Nothing to prepare yet.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2.5">
            <div
              role="progressbar"
              aria-label="Prep progress"
              aria-valuemin={0}
              aria-valuemax={list.length}
              aria-valuenow={done.length}
              className="h-1 w-24 shrink-0 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${(done.length / list.length) * 100}%` }}
              />
            </div>
            <p className="text-xs leading-4 text-muted-foreground">
              {done.length} of {list.length} done
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border bg-card">
            {open.length > 0 && <ul className="divide-y">{open.map(row)}</ul>}
            {done.length > 0 && (
              <>
                <button
                  type="button"
                  aria-expanded={doneOpen}
                  aria-controls="activity-prep-done"
                  className={`flex min-h-11 w-full items-center gap-2 px-4 text-left text-sm leading-5 text-muted-foreground outline-none hover:bg-accent focus-visible:bg-accent ${open.length ? "border-t" : ""}`}
                  onClick={() => setDoneOpen((value) => !value)}
                >
                  <span className="flex-1">{done.length} done</span>
                  <CaretRightIcon
                    aria-hidden="true"
                    className={cn("size-4", doneOpen && "rotate-90")}
                  />
                </button>
                {doneOpen && (
                  <ul id="activity-prep-done" className="divide-y border-t">
                    {done.map(row)}
                  </ul>
                )}
              </>
            )}
          </div>
        </>
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
          onAction={() => setNotice(null)}
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
          activity={editing.mode === "add" ? activity : undefined}
          overDrawer
          people={people}
          current={current}
          finalFocus={finalFocus}
          onClose={close}
        />
      )}
      {editing?.mode === "from-prep" && (
        <AddFromPrepDialog
          api={api}
          trip={trip}
          activity={activity}
          tasks={tripWide}
          current={current}
          expenses={(task) => ({
            count: costs(task).length,
            amount: amounts(task),
          })}
          finalFocus={finalFocus}
          onClose={close}
        />
      )}
      {editing?.mode === "remove" && (
        <RemoveFromActivityDialog
          api={api}
          task={editing.task}
          activityTitle={activity.title}
          expenses={costs(editing.task).length}
          finalFocus={headingFocus}
          onClose={close}
        />
      )}
      {editing?.mode === "delete" && (
        <DeletePrepTaskDialog
          api={api}
          task={editing.task}
          expenses={costs(editing.task).length}
          finalFocus={headingFocus}
          onClose={close}
        />
      )}
    </section>
  );
}
