"use client";

import { useRef, useState, type ComponentProps, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  assigneeOptions,
  PrepSelect,
} from "@/components/features/prep/prep-select";
import { TripDialog } from "@/components/shared/trip-dialog";
import { TripError } from "@/components/shared/trip-states";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dateLabel, localDate, moveDate } from "@/lib/activity-time";
import { useApi } from "@/lib/api";
import { allActivities, allActivitiesKey } from "@/lib/itinerary";
import type { Participant } from "@/lib/memberships";
import {
  prepTitleError,
  type PrepActivity,
  type PrepTask,
  type PrepTaskKind,
  type usePrepApi,
} from "@/lib/prep";
import { tripDayCount, type Trip } from "@/lib/trips";

const kinds: { value: PrepTaskKind; label: string; hint: string }[] = [
  {
    value: "one_person",
    label: "One person does it",
    hint: "Like booking the van. It's done once they finish.",
  },
  {
    value: "everyone",
    label: "Everyone does it",
    hint: "Like renewing a passport. Each person ticks their own.",
  },
];

/** Adds a task, or edits `task`. Kind and assignee are only set when adding. */
export function PrepTaskDialog({
  api,
  trip,
  task,
  people,
  finalFocus,
  onClose,
}: {
  api: Pick<
    ReturnType<typeof usePrepApi>,
    "pending" | "error" | "create" | "update"
  >;
  trip: Pick<Trip, "id" | "time_zone" | "start_date" | "end_date">;
  task?: PrepTask;
  people: Participant[];
  finalFocus: ComponentProps<typeof TripDialog>["finalFocus"];
  onClose: () => void;
}) {
  const titleInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(task?.title ?? "");
  const [kind, setKind] = useState<PrepTaskKind>("one_person");
  const [assignee, setAssignee] = useState(0);
  const [activity, setActivity] = useState(task?.activity?.id ?? 0);
  const [date, setDate] = useState(task?.date ?? "none");
  const [invalid, setInvalid] = useState<string | null>(null);
  const read = useApi();
  const activities = useQuery({
    queryKey: allActivitiesKey(trip.id),
    queryFn: ({ signal }) => allActivities(read, trip.id, signal),
    retry: false,
  });
  // Keep the saved link selectable even when the list hasn't loaded.
  const choices: PrepActivity[] = [
    ...(activities.data ?? []),
    ...(task?.activity &&
    !activities.data?.some((item) => item.id === task.activity?.id)
      ? [task.activity]
      : []),
  ];

  const days = Array.from(
    { length: tripDayCount(trip.start_date, trip.end_date) },
    (_, index) => moveDate(trip.start_date, index),
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (api.pending) return;
    const problem = prepTitleError(title);
    setInvalid(problem);
    if (problem) return;
    const details = {
      title,
      activity_id: activity || null,
      date: date === "none" ? null : date,
    };
    try {
      const saved = task
        ? await api.update(task.id, details)
        : await api.create({
            ...details,
            kind,
            assignee_user_id:
              kind === "one_person" && assignee ? assignee : null,
          });
      if (saved) onClose();
    } catch {
      /* Keep the dialog open with the entered values and show the error. */
    }
  }

  return (
    <TripDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={task ? "Edit task" : "Add a task"}
      mobilePresentation="sheet"
      busy={api.pending}
      disablePointerDismissal
      initialFocus={titleInput}
      finalFocus={finalFocus}
    >
      <form onSubmit={submit}>
        <fieldset disabled={api.pending} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="prep-task-title">What needs doing?</Label>
            <Input
              id="prep-task-title"
              ref={titleInput}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              aria-invalid={!!invalid}
            />
          </div>
          {!task && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Who does it?</legend>
              {kinds.map((option) => (
                <label
                  key={option.value}
                  className="flex min-h-11 cursor-pointer items-start gap-3 py-1"
                >
                  <input
                    type="radio"
                    name="prep-task-kind"
                    className="mt-0.5 size-5 shrink-0 cursor-pointer accent-primary"
                    checked={kind === option.value}
                    onChange={() => setKind(option.value)}
                  />
                  <span className="min-w-0">
                    <span className="block font-medium">{option.label}</span>
                    <span className="block text-sm text-muted-foreground">
                      {option.hint}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          {!task && kind === "one_person" && (
            <PrepSelect
              id="prep-task-assignee"
              label="Who's doing it?"
              options={assigneeOptions(people)}
              value={String(assignee)}
              onChange={(next) => setAssignee(Number(next))}
            />
          )}
          <div className="space-y-2">
            <PrepSelect
              id="prep-task-activity"
              label="Activity (optional)"
              options={[
                { value: "0", label: "No activity" },
                ...choices.map((item) => ({
                  value: String(item.id),
                  label: `${item.title} · ${dateLabel(localDate(item.starts_at, trip.time_zone))}`,
                })),
              ]}
              value={String(activity)}
              onChange={(next) => setActivity(Number(next))}
            />
            {(activities.isPending || activities.isError) && (
              <p role="status" className="text-sm text-muted-foreground">
                {activities.isPending
                  ? "Loading activities…"
                  : "Activities couldn't load. You can still save this task."}
              </p>
            )}
          </div>
          <PrepSelect
            id="prep-task-date"
            label="Date (optional)"
            options={[
              { value: "none", label: "No date" },
              // A saved date can fall outside the trip if the trip has moved.
              ...(task?.date && !days.includes(task.date)
                ? [
                    {
                      value: task.date,
                      label: `${dateLabel(task.date)} (outside the trip)`,
                    },
                  ]
                : []),
              ...days.map((day) => ({ value: day, label: dateLabel(day) })),
            ]}
            value={date}
            onChange={setDate}
          />
          {invalid && (
            <Alert variant="destructive">
              <AlertDescription>{invalid}</AlertDescription>
            </Alert>
          )}
          {api.error && <TripError error={api.error} />}
          <Button type="submit" className="min-h-12 w-full">
            {api.pending ? "Saving…" : task ? "Save" : "Add task"}
          </Button>
        </fieldset>
      </form>
    </TripDialog>
  );
}
