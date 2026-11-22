"use client";

import { useState, type ComponentProps } from "react";
import { MagnifyingGlassIcon, ReceiptIcon } from "@phosphor-icons/react";
import { TripDialog } from "@/components/shared/trip-dialog";
import { TripError } from "@/components/shared/trip-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dateLabel, localDate } from "@/lib/activity-time";
import { participantName, type Participant } from "@/lib/memberships";
import type { PrepActivity, PrepTask, usePrepApi } from "@/lib/prep";
import type { Trip } from "@/lib/trips";
import { plural } from "@/lib/utils";

/**
 * Figma "Add from Prep": pick trip-wide tasks (no activity yet) to move into
 * this activity. Their expenses follow them, which the API does on update.
 */
export function AddFromPrepDialog({
  api,
  trip,
  activity,
  tasks,
  current,
  expenses,
  finalFocus,
  onClose,
}: {
  api: Pick<ReturnType<typeof usePrepApi>, "pending" | "error" | "update">;
  trip: Pick<Trip, "time_zone">;
  activity: PrepActivity;
  /** Unfinished tasks with no activity. */
  tasks: PrepTask[];
  current?: Participant;
  expenses: (task: PrepTask) => { count: number; amount?: string };
  finalFocus: ComponentProps<typeof TripDialog>["finalFocus"];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const term = query.trim().toLowerCase();
  const shown = tasks.filter((task) => task.title.toLowerCase().includes(term));
  // Tasks that already moved drop out of `tasks` after the list refreshes.
  const chosen = tasks.filter((task) => picked.includes(task.id));

  const detail = (task: PrepTask) => {
    const who =
      task.kind === "everyone"
        ? `Everyone · ${task.ready_user_ids.length} of ${task.ready_user_ids.length + task.waiting_user_ids.length}`
        : task.assignee
          ? task.assignee.user_id === current?.user_id
            ? "You're on it"
            : `${participantName(task.assignee)} is on it`
          : "Up for grabs";
    const cost = expenses(task);
    return [who, cost.count && plural(cost.count, "expense"), cost.amount]
      .filter(Boolean)
      .join(" · ");
  };

  async function add() {
    if (api.pending || !chosen.length) return;
    try {
      for (const [index, task] of chosen.entries()) {
        const last = index === chosen.length - 1;
        if (
          !(await api.update(
            task.id,
            { title: task.title, activity_id: activity.id, date: task.date },
            last
              ? `${plural(chosen.length, "task")} added to ${activity.title}.`
              : "",
          ))
        )
          return;
      }
      onClose();
    } catch {
      /* Keep the dialog open with the remaining picks and show the error. */
    }
  }

  return (
    <TripDialog
      open
      onOpenChange={(open) => {
        if (!open && !api.pending) onClose();
      }}
      title="Add from Prep"
      description={`${activity.title} · ${dateLabel(localDate(activity.starts_at, trip.time_zone))}`}
      mobilePresentation="fullscreen"
      // Opened over the activity drawer, which a nested dialog doesn't dim by default.
      backdropClassName="bg-black/60"
      busy={api.pending}
      finalFocus={finalFocus}
      footer={
        <div className="flex w-full gap-3 md:justify-end">
          <Button
            type="button"
            variant="outline"
            className="flex-1 md:flex-none"
            disabled={api.pending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1 md:flex-none"
            disabled={api.pending || !chosen.length}
            onClick={() => void add()}
          >
            {api.pending
              ? "Adding…"
              : chosen.length
                ? `Add ${plural(chosen.length, "task")}`
                : "Add tasks"}
          </Button>
        </div>
      }
    >
      <div className="min-w-0 space-y-4 md:space-y-5">
        <div className="space-y-2">
          <Label htmlFor="add-from-prep-search">Search</Label>
          <div className="relative">
            <MagnifyingGlassIcon
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="add-from-prep-search"
              type="search"
              className="pl-9 md:min-h-12"
              placeholder="Search prep tasks"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>
        {!tasks.length ? (
          <p className="text-sm leading-5 text-muted-foreground">
            No trip-wide tasks to add. Tasks already on an activity stay there.
          </p>
        ) : !shown.length ? (
          <p className="text-sm leading-5 break-words text-muted-foreground">
            No tasks match “{query.trim()}”.
          </p>
        ) : (
          <ul
            aria-label="Trip-wide tasks"
            className="divide-y overflow-hidden rounded-2xl border bg-card"
          >
            {shown.map((task) => (
              <li key={task.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3.5 py-3 hover:bg-accent md:p-4">
                  <input
                    type="checkbox"
                    className="size-5 shrink-0 cursor-pointer accent-primary"
                    checked={picked.includes(task.id)}
                    onChange={(event) =>
                      setPicked(
                        event.target.checked
                          ? [...picked, task.id]
                          : picked.filter((id) => id !== task.id),
                      )
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-base leading-6 font-medium break-words">
                      {task.title}
                    </span>
                    <span className="block text-[13px] leading-5 break-words text-muted-foreground">
                      {detail(task)}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <p className="flex items-center gap-2.5 rounded-lg bg-muted p-3 text-sm leading-5 text-muted-foreground">
          <ReceiptIcon aria-hidden="true" className="size-4 shrink-0" />
          Their expenses move to this activity too.
        </p>
        {api.error && <TripError error={api.error} />}
      </div>
    </TripDialog>
  );
}
