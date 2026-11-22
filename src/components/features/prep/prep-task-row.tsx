"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowBendUpLeftIcon,
  CheckCircleIcon,
  CheckIcon,
  EyeIcon,
  PencilSimpleIcon,
  UsersIcon,
  XIcon,
} from "@phosphor-icons/react";
import { OptionsMenu } from "@/components/shared/options-menu";
import { Button } from "@/components/ui/button";
import { dateLabel } from "@/lib/activity-time";
import {
  participantInitials,
  participantName,
  type Participant,
} from "@/lib/memberships";
import { isTaskDone, takesPart, usePrepApi, type PrepTask } from "@/lib/prep";

export type PrepRowOpen = "details" | "edit" | "delete" | "remove";

/** Reopen (when finished), Edit and Delete: shared by the row and details menus. */
export const taskMenuItems = (
  task: PrepTask,
  onOpen: (mode: "edit" | "delete") => void,
  reopen: () => void,
) => [
  ...(task.completed_at
    ? [
        {
          label: "Reopen",
          icon: <CheckIcon aria-hidden="true" />,
          onClick: reopen,
        },
      ]
    : []),
  {
    label: "Edit",
    icon: <PencilSimpleIcon aria-hidden="true" />,
    onClick: () => onOpen("edit"),
  },
  {
    label: "Delete",
    icon: <XIcon aria-hidden="true" />,
    destructive: true,
    onClick: () => onOpen("delete"),
  },
];

/**
 * One Prep row. The lead says who acts next: a checkbox you can tick, a dashed
 * circle nobody has claimed, the assignee's initials, or a check when done. The
 * reading area opens the task's details; the checkbox, Claim/Drop, the activity
 * link and the options menu stay separately operable.
 */
export function PrepTaskRow({
  task,
  current,
  canEdit,
  byActivity = false,
  inActivity = false,
  amounts,
  onFailure,
  onAction,
  onActionError,
  onOpen,
}: {
  task: PrepTask;
  current?: Participant;
  canEdit: boolean;
  /** The By activity view: the group heading names the activity, so the row says who. */
  byActivity?: boolean;
  /** Inside an activity: like By activity, but your own tasks need no "You"
   * (the checkbox and Drop say it), and the menu can remove it from the activity. */
  inActivity?: boolean;
  /** Linked expense totals, already formatted per currency. */
  amounts?: string;
  onFailure: (error: Error) => void | Promise<void>;
  onAction: (id: number) => void;
  onActionError: (error: Error) => void;
  onOpen: (mode: PrepRowOpen) => void;
}) {
  // Each row has its own hook, so a tick on one row never drops another's.
  const api = usePrepApi(task.trip_id, onFailure);
  const [intent, setIntent] = useState<boolean | null>(null);
  const active = takesPart(current);
  const me = current?.user_id;
  const everyone = task.kind === "everyone";
  const mine = me !== undefined && task.assignee?.user_id === me;
  const done = isTaskDone(task);
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
  const assignee = task.assignee ? participantName(task.assignee) : "";
  const ready = task.ready_user_ids.length;
  const total = ready + task.waiting_user_ids.length;

  // Who's on it or who did it, then the day, the activity and its costs.
  // Your own and unclaimed tasks need no "who" outside By activity: their
  // section already says it. Everyone tasks show only the count; the details
  // list who's done.
  const grouped = byActivity || inActivity;
  const who = done
    ? everyone
      ? "Everyone's done"
      : `Done by ${mine ? "you" : assignee}`
    : everyone
      ? ""
      : mine
        ? byActivity
          ? "You"
          : ""
        : task.assignee
          ? `${assignee} is on it`
          : grouped
            ? "Up for grabs"
            : "";
  const activity = !grouped && task.activity;
  const parts = [
    who,
    task.date ? dateLabel(task.date) : "",
    amounts ?? "",
  ].filter(Boolean);
  if (!parts.length && !activity && !everyone && !task.assignee)
    parts.push("Whole trip");

  const claimable = active && !everyone && !finished && !task.assignee;
  const droppable = !everyone && mine && !finished;

  return (
    <li
      id={`prep-task-${task.id}`}
      tabIndex={-1}
      className="flex min-h-16 items-center gap-2 py-1.5 pr-1 pl-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset sm:gap-3"
    >
      <span className="flex size-11 shrink-0 items-center justify-center">
        {tickable ? (
          <input
            type="checkbox"
            className="size-5 cursor-pointer accent-primary"
            aria-label={`${task.title} done`}
            checked={ticked}
            onChange={(event) => void tick(event.target.checked)}
          />
        ) : done ? (
          <CheckCircleIcon
            aria-label="Done"
            weight="fill"
            className="size-5 text-primary"
          />
        ) : everyone ? (
          <UsersIcon
            aria-label="Everyone"
            className="size-5 text-muted-foreground"
          />
        ) : task.assignee ? (
          <span
            aria-hidden="true"
            className="flex size-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-primary"
          >
            {participantInitials(task.assignee)}
          </span>
        ) : (
          <span
            aria-label="Unclaimed"
            className="size-5 rounded-full border-[1.5px] border-dashed border-input"
          />
        )}
      </span>
      <div className="relative min-w-0 flex-1 py-1.5">
        <button
          type="button"
          className={`block w-full text-left font-medium break-words outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-3 focus-visible:after:ring-ring/50 ${done ? "text-muted-foreground line-through" : ""}`}
          onClick={() => onOpen("details")}
        >
          {task.title}
        </button>
        {(parts.length > 0 || activity) && (
          <p className="mt-0.5 text-[0.8125rem] leading-5 break-words text-muted-foreground">
            {parts.join(" · ")}
            {activity && (
              <>
                {parts.length > 0 && " · "}
                <Link
                  href={`/trips/${task.trip_id}?activity=${activity.id}`}
                  className="relative z-10 text-primary underline-offset-2 hover:underline"
                >
                  {activity.title}
                </Link>
              </>
            )}
          </p>
        )}
      </div>
      {everyone && !done && (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
          <UsersIcon aria-hidden="true" className="size-3" />
          <span className="sr-only">Ready: </span>
          {ready} of {total}
        </span>
      )}
      {(claimable || droppable) && (
        <Button
          variant="outline"
          size="sm"
          // Drawn at Figma's 28px; the invisible ::before keeps a 44px tap target.
          className="relative z-10 shrink-0 before:absolute before:inset-x-0 before:-inset-y-2 before:content-['']"
          disabled={api.pending}
          aria-label={`${claimable ? "Claim" : "Drop"} ${task.title}`}
          onClick={() =>
            void act(() => (claimable ? api.claim(task.id) : api.drop(task.id)))
          }
        >
          {claimable ? "Claim" : "Drop"}
        </Button>
      )}
      {canEdit && (
        <OptionsMenu
          name={task.title}
          description={
            [...parts, activity && activity.title]
              .filter(Boolean)
              .join(" · ") || undefined
          }
          items={[
            {
              label: "View",
              icon: <EyeIcon aria-hidden="true" />,
              onClick: () => onOpen("details"),
            },
            ...taskMenuItems(
              task,
              onOpen,
              () => void act(() => api.reopen(task.id)),
            ).flatMap((item) =>
              inActivity && item.label === "Delete"
                ? [
                    {
                      label: "Remove from activity",
                      icon: <ArrowBendUpLeftIcon aria-hidden="true" />,
                      onClick: () => onOpen("remove"),
                    },
                    item,
                  ]
                : [item],
            ),
          ]}
        />
      )}
    </li>
  );
}
