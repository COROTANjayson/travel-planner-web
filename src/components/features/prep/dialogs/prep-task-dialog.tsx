"use client";

import { useRef, useState, type ComponentProps } from "react";
import { useQuery } from "@tanstack/react-query";
import { PlusIcon } from "@phosphor-icons/react";
import {
  PrepSelect,
  prepChipClass,
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
import { participantName, type Participant } from "@/lib/memberships";
import {
  isTaskDone,
  prepTitleError,
  type PrepActivity,
  type PrepTask,
  type PrepTaskKind,
  type usePrepApi,
} from "@/lib/prep";
import { tripDayCount, type Trip } from "@/lib/trips";

export type Who = "up" | "me" | "someone" | "everyone";
const whoChips: { value: Who; label: string; hint: string }[] = [
  {
    value: "up",
    label: "Up for grabs",
    hint: "Anyone on the trip can claim it later.",
  },
  { value: "me", label: "Me", hint: "It shows under For you on your list." },
  {
    value: "someone",
    label: "Pick someone",
    hint: "It shows under For you on their list.",
  },
  {
    value: "everyone",
    label: "Everyone",
    hint: "Each person ticks their own, like renewing a passport.",
  },
];

/**
 * Adds a task, or edits `task`. Editing an unfinished task can change who's on
 * it, including switching to or from Everyone, which starts it over. Save and
 * add another keeps the assignment, day and activity, clears the title and
 * focuses it.
 */
export function PrepTaskDialog({
  api,
  trip,
  task,
  people,
  current,
  finalFocus,
  onClose,
}: {
  api: Pick<
    ReturnType<typeof usePrepApi>,
    "pending" | "error" | "create" | "update" | "assign" | "reset"
  >;
  trip: Pick<Trip, "id" | "time_zone" | "start_date" | "end_date">;
  task?: PrepTask;
  /** People taking part; only they can be picked. */
  people: Participant[];
  current?: Participant;
  finalFocus: ComponentProps<typeof TripDialog>["finalFocus"];
  onClose: () => void;
}) {
  const titleInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(task?.title ?? "");
  const me = current?.user_id;
  const saved = task?.assignee?.user_id ?? 0;
  const [who, setWho] = useState<Who>(
    task?.kind === "everyone"
      ? "everyone"
      : !saved
        ? "up"
        : saved === me
          ? "me"
          : "someone",
  );
  const [assignee, setAssignee] = useState(saved === me ? 0 : saved);
  const [activity, setActivity] = useState(task?.activity?.id ?? 0);
  const [date, setDate] = useState(task?.date ?? "none");
  const [showDay, setShowDay] = useState(!!task);
  const [showActivity, setShowActivity] = useState(!!task?.activity);
  const [invalid, setInvalid] = useState<string | null>(null);
  // Keep the key after failures: an edited retry must not duplicate a saved task.
  const key = useRef("");
  const read = useApi();
  const activities = useQuery({
    queryKey: allActivitiesKey(trip.id),
    queryFn: ({ signal }) => allActivities(read, trip.id, signal),
    retry: false,
    enabled: showActivity,
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
  const others = people.filter((person) => person.user_id !== me);
  const takesPartMe = people.some((person) => person.user_id === me);
  const pickWho = !task || !isTaskDone(task);
  const chips = whoChips.filter((chip) => chip.value !== "me" || takesPartMe);
  const kind: PrepTaskKind = who === "everyone" ? "everyone" : "one_person";
  const switched = !!task && kind !== task.kind;
  // Keep a saved assignee selectable even if they're no longer taking part.
  const formerAssignee =
    task?.assignee &&
    task.assignee.user_id !== me &&
    !others.some((person) => person.user_id === task.assignee?.user_id)
      ? [task.assignee]
      : [];

  async function save(another: boolean) {
    if (api.pending) return;
    const problem =
      prepTitleError(title) ??
      (pickWho && who === "someone" && !assignee
        ? "Pick who's doing it."
        : null);
    setInvalid(problem);
    if (problem) {
      titleInput.current?.focus();
      return;
    }
    const details = {
      title,
      activity_id: activity || null,
      date: date === "none" ? null : date,
    };
    const assigneeID =
      who === "me" ? (me ?? null) : who === "someone" ? assignee : null;
    try {
      if (task) {
        const edits = pickWho && switched ? { ...details, kind } : details;
        if (!(await api.update(task.id, edits))) return;
        // A kind switch leaves the task unassigned.
        const before = switched ? null : (task.assignee?.user_id ?? null);
        if (
          pickWho &&
          kind === "one_person" &&
          assigneeID !== before &&
          !(await api.assign(task.id, assigneeID))
        )
          return;
        onClose();
        return;
      }
      const input = { ...details, kind, assignee_user_id: assigneeID };
      if (!key.current) key.current = crypto.randomUUID();
      if (!(await api.create(input, key.current))) return;
      key.current = "";
      if (!another) return onClose();
      setTitle("");
      api.reset();
      titleInput.current?.focus();
    } catch {
      /* Keep the dialog open with the entered values and show the error. */
    }
  }
  const assigneeLabel =
    task?.kind === "everyone"
      ? "Everyone · each person ticks their own"
      : task?.assignee
        ? `${task.assignee.user_id === me ? "You" : participantName(task.assignee)} · one person does it`
        : "Up for grabs · one person does it";

  return (
    <TripDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={task ? "Edit task" : "Add a task"}
      mobilePresentation="tall-sheet"
      busy={api.pending}
      disablePointerDismissal
      initialFocus={titleInput}
      finalFocus={finalFocus}
      footer={
        <div className="flex w-full flex-col-reverse gap-3 md:flex-row md:items-center md:justify-end">
          {!task && (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 w-full md:w-auto"
              disabled={api.pending}
              onClick={() => save(true)}
            >
              Save and add another
            </Button>
          )}
          <Button
            type="submit"
            form="prep-task-form"
            className="min-h-11 w-full md:w-auto"
            disabled={api.pending}
          >
            {api.pending ? "Saving…" : task ? "Save" : "Add task"}
          </Button>
        </div>
      }
    >
      <form
        id="prep-task-form"
        onSubmit={(event) => {
          event.preventDefault();
          return save(false);
        }}
      >
        <fieldset disabled={api.pending} className="min-w-0 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="prep-task-title">
              What needs doing?
              <span aria-hidden="true"> *</span>
            </Label>
            <Input
              id="prep-task-title"
              ref={titleInput}
              value={title}
              required
              onChange={(event) => setTitle(event.target.value)}
              aria-invalid={!!invalid && !!prepTitleError(title)}
            />
          </div>
          <fieldset className="min-w-0 space-y-2">
            <legend className="mb-2 text-sm font-medium">
              Who&apos;s on it?
            </legend>
            {!pickWho && task ? (
              <>
                <p>{assigneeLabel}</p>
                <p className="text-[0.8125rem] text-muted-foreground">
                  {task.kind === "everyone"
                    ? "Everyone has done it."
                    : "Reopen it to change who's on it."}
                </p>
              </>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {chips.map((chip) => (
                    <Button
                      key={chip.value}
                      type="button"
                      variant="ghost"
                      className={prepChipClass}
                      aria-pressed={who === chip.value}
                      onClick={() => setWho(chip.value)}
                    >
                      {chip.label}
                    </Button>
                  ))}
                </div>
                {who === "someone" && (
                  <PrepSelect
                    id="prep-task-assignee"
                    label="Person"
                    options={[
                      { value: "0", label: "Choose a person" },
                      ...[...others, ...formerAssignee].map((person) => ({
                        value: String(person.user_id),
                        label: participantName(person),
                      })),
                    ]}
                    value={String(assignee)}
                    onChange={(next) => setAssignee(Number(next))}
                  />
                )}
                <p className="text-[0.8125rem] text-muted-foreground">
                  {chips.find((chip) => chip.value === who)?.hint}
                </p>
                {task &&
                  switched &&
                  task.kind === "everyone" &&
                  task.ready_user_ids.length > 0 && (
                    <p className="text-[0.8125rem] text-muted-foreground">
                      The {task.ready_user_ids.length} done so far will be
                      cleared.
                    </p>
                  )}
              </>
            )}
          </fieldset>
          {showDay && (
            <PrepSelect
              id="prep-task-date"
              label="Trip day"
              options={[
                { value: "none", label: "No day" },
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
          )}
          {showActivity && (
            <div className="space-y-2">
              <PrepSelect
                id="prep-task-activity"
                label="Activity"
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
          )}
          {(!showDay || !showActivity) && (
            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-label="Add more"
            >
              <p
                aria-hidden="true"
                className="basis-full text-sm text-muted-foreground"
              >
                Add more
              </p>
              {(
                [
                  ["Trip day", showDay, setShowDay],
                  ["Activity", showActivity, setShowActivity],
                ] as const
              )
                .filter(([, shown]) => !shown)
                .map(([label, , show]) => (
                  <Button
                    key={label}
                    type="button"
                    variant="secondary"
                    className="min-h-11 rounded-full"
                    aria-label={`Add ${label.toLowerCase()}`}
                    onClick={() => show(true)}
                  >
                    <PlusIcon aria-hidden="true" className="size-3.5" />
                    {label}
                  </Button>
                ))}
            </div>
          )}
          {invalid && (
            <Alert variant="destructive">
              <AlertDescription>{invalid}</AlertDescription>
            </Alert>
          )}
          {api.error && <TripError error={api.error} />}
        </fieldset>
      </form>
    </TripDialog>
  );
}
