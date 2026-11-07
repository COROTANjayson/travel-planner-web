"use client";

import { useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { OptionsMenu } from "@/components/shared/options-menu";
import { Button } from "@/components/ui/button";
import { dateLabel, localDate } from "@/lib/activity-time";
import { participantName, type Participant } from "@/lib/memberships";
import { isTaskDone, takesPart, usePrepApi, type PrepTask } from "@/lib/prep";

export function PrepTaskRow({
  task,
  timeZone,
  participants,
  current,
  canEdit,
  onFailure,
  onAction,
  onActionError,
  onOpen,
}: {
  task: PrepTask;
  timeZone: string;
  participants?: Participant[];
  current?: Participant;
  canEdit: boolean;
  onFailure: (error: Error) => void | Promise<void>;
  onAction: (id: number) => void;
  onActionError: (error: Error) => void;
  onOpen: (mode: "edit" | "assign" | "delete") => void;
}) {
  // Each row has its own hook, so a tick on one row never drops another's.
  const api = usePrepApi(task.trip_id, onFailure);
  const [intent, setIntent] = useState<boolean | null>(null);
  const active = takesPart(current);
  const me = current?.user_id;
  const everyone = task.kind === "everyone";
  const mine = me !== undefined && task.assignee?.user_id === me;
  const finished = task.completed_at !== null;
  const ticked =
    intent ??
    (everyone
      ? me !== undefined && task.ready_user_ids.includes(me)
      : finished);
  const tickable = active && (everyone || mine);

  async function act(operation: () => Promise<unknown>) {
    onAction(task.id);
    try {
      await operation();
    } catch (failure) {
      onActionError(failure as Error);
    }
  }
  async function tick(next: boolean) {
    if (api.pending) return;
    setIntent(next);
    await act(() => (next ? api.complete(task.id) : api.reopen(task.id)));
    setIntent(null);
  }
  const name = (id: number) => {
    if (id === me) return "You";
    const person = participants?.find((other) => other.user_id === id);
    return person ? participantName(person) : "Traveler";
  };
  const assignee = task.assignee ? participantName(task.assignee) : "";
  const ready = task.ready_user_ids.length;
  const total = ready + task.waiting_user_ids.length;
  const Icon = isTaskDone(task) ? CheckCircle2 : Circle;
  // One-person tasks: [label, variant, shown, action].
  const actions = [
    ["Claim", "outline", active && !finished && !task.assignee, api.claim],
    ["Drop", "ghost", mine && !finished, api.drop],
    ["Reopen", "ghost", canEdit && finished && !mine, api.reopen],
  ] as const;

  return (
    <li
      id={`prep-task-${task.id}`}
      tabIndex={-1}
      className="flex items-start gap-1 rounded-2xl border bg-card p-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {tickable ? (
        <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center">
          <input
            type="checkbox"
            className="size-5 cursor-pointer accent-primary"
            aria-label={`${task.title} done`}
            checked={ticked}
            onChange={(event) => void tick(event.target.checked)}
          />
        </label>
      ) : (
        <span className="flex size-11 shrink-0 items-center justify-center text-muted-foreground">
          <Icon aria-hidden="true" className="size-5" />
        </span>
      )}
      <div className="min-w-0 flex-1 py-2">
        <p className="font-medium break-words">{task.title}</p>
        {task.activity && (
          <p className="mt-1 text-sm break-words text-muted-foreground">
            Activity: {task.activity.title} ·{" "}
            {dateLabel(localDate(task.activity.starts_at, timeZone))}
          </p>
        )}
        {task.date && (
          <p className="mt-1 text-sm text-muted-foreground">
            Date: {dateLabel(task.date)}
          </p>
        )}
        {everyone ? (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              {ready} of {total} ready
            </p>
            <p className="text-sm break-words text-muted-foreground">
              {task.waiting_user_ids.length
                ? `Still to do: ${task.waiting_user_ids.map(name).join(", ")}`
                : "Everyone is ready"}
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm break-words text-muted-foreground">
            {finished
              ? `Done by ${mine ? "you" : assignee}`
              : mine
                ? "You're on it"
                : task.assignee
                  ? `${assignee} is on it`
                  : "Nobody has claimed this yet"}
          </p>
        )}
        {!everyone &&
          actions
            .filter(([, , shown]) => shown)
            .map(([label, variant, , run]) => (
              <Button
                key={label}
                className="mt-2 min-h-11"
                variant={variant}
                disabled={api.pending}
                aria-label={`${label} ${task.title}`}
                onClick={() => void act(() => run(task.id))}
              >
                {label}
              </Button>
            ))}
      </div>
      {canEdit && (
        <OptionsMenu
          name={task.title}
          items={[
            { label: "Edit", onClick: () => onOpen("edit") },
            ...(task.kind === "one_person" && !task.completed_at
              ? [{ label: "Assign", onClick: () => onOpen("assign") }]
              : []),
            {
              label: "Delete",
              destructive: true,
              onClick: () => onOpen("delete"),
            },
          ]}
        />
      )}
    </li>
  );
}
