"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { AssignPrepTaskDialog } from "@/components/features/prep/dialogs/assign-prep-task-dialog";
import { DeletePrepTaskDialog } from "@/components/features/prep/dialogs/delete-prep-task-dialog";
import { PrepTaskDialog } from "@/components/features/prep/dialogs/prep-task-dialog";
import { PrepTaskRow } from "@/components/features/prep/prep-task-row";
import { TripError } from "@/components/shared/trip-states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import type { Participant } from "@/lib/memberships";
import {
  isTaskDone,
  prepKey,
  takesPart,
  usePrepApi,
  type PrepTask,
} from "@/lib/prep";
import type { Trip } from "@/lib/trips";

type Editing =
  { mode: "add" } | { mode: "edit" | "assign" | "delete"; task: PrepTask };

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
  const [editing, setEditing] = useState<Editing | null>(null);
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
    document.getElementById(`prep-task-${id}`)?.focus();
  }, [tasks.dataUpdatedAt]);

  const people = (participants ?? []).filter(takesPart);
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
      ? (document.getElementById(`prep-task-${editing.task.id}`) ??
        document.getElementById("prep-heading"))
      : addTrigger.current;
  const row = (task: PrepTask) => (
    <PrepTaskRow
      key={task.id}
      task={task}
      timeZone={trip.time_zone}
      participants={participants}
      current={current}
      canEdit={canEdit}
      onFailure={onFailure}
      onAction={(id) => {
        acted.current = id;
        setNotice(null);
      }}
      onActionError={setNotice}
      onOpen={(mode) => open({ mode, task })}
    />
  );
  const list = tasks.data ?? [];
  const todo = list.filter((task) => !isTaskDone(task));
  const done = list.filter(isTaskDone);

  return (
    <section className="space-y-6" aria-labelledby="prep-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="prep-heading"
            tabIndex={-1}
            className="text-2xl font-semibold outline-none"
          >
            Prep
          </h2>
          <p className="text-muted-foreground">
            What the group needs to sort out before the trip.
          </p>
        </div>
        {canEdit && tasks.isSuccess && (
          <Button className="hidden min-h-11 md:inline-flex" onClick={add}>
            <Plus aria-hidden="true" />
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
        <div className="day-empty [padding:1rem] [border:1px_solid_var(--border)] [border-radius:1rem] [background:var(--card)]">
          <p className="font-semibold">Nothing to prepare yet</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {canEdit
              ? "Add the first thing your group needs to sort out."
              : "Tasks will appear here when an editor adds them."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {todo.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold">To do</h3>
              <ul className="space-y-3">{todo.map(row)}</ul>
            </div>
          )}
          {done.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold">Done</h3>
              <ul className="space-y-3">{done.map(row)}</ul>
            </div>
          )}
        </div>
      )}
      {canEdit && tasks.isSuccess && (
        <div className="mobile-add-activity fixed right-[max(1.5rem,env(safe-area-inset-right,0px))] bottom-[var(--app-bottom)] z-30 md:hidden">
          <Button className="min-h-12" onClick={add}>
            <Plus aria-hidden="true" />
            Add task
          </Button>
        </div>
      )}
      {(editing?.mode === "add" || editing?.mode === "edit") && (
        <PrepTaskDialog
          api={api}
          trip={trip}
          task={editing.mode === "edit" ? editing.task : undefined}
          people={people}
          finalFocus={finalFocus}
          onClose={close}
        />
      )}
      {editing?.mode === "assign" && (
        <AssignPrepTaskDialog
          api={api}
          task={editing.task}
          people={people}
          finalFocus={finalFocus}
          onClose={close}
        />
      )}
      {editing?.mode === "delete" && (
        <DeletePrepTaskDialog
          api={api}
          task={editing.task}
          finalFocus={finalFocus}
          onClose={close}
        />
      )}
    </section>
  );
}
