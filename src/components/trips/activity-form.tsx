"use client";

import { useId, useRef, useState, type Ref, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Temporal } from "@js-temporal/polyfill";
import { Clock, Plus, Tag } from "lucide-react";
import { ApiError, useApi } from "@/lib/api";
import {
  activityCategories,
  activityCategoryIcons,
  type ActivityInput,
  type ChecklistItem,
} from "@/lib/itinerary";
import { type Place, type PlaceCandidate } from "@/lib/places";
import {
  endAfterMinutes,
  instantToLocal,
  localToInstant,
  type Occurrence,
} from "@/lib/activity-time";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TripError } from "./trip-states";
import { DateTimeField } from "./date-time-field";

import type { CostChange, ExpensePerson } from "@/lib/expenses";
import { ActivityExpenseDrafts } from "./activity-expense-drafts";

const durations = { "30": 30, "60": 60, "120": 120 } as const;
type Duration = keyof typeof durations | "custom";

function formatEndTime(instant: string, zone: string, startDate: string) {
  const local = instantToLocal(instant, zone).value;
  const time = new Intl.DateTimeFormat(undefined, {
    timeZone: zone,
    timeStyle: "short",
  }).format(new Date(instant));
  return `${time}${local.slice(0, 10) > startDate ? ` on ${local.slice(0, 10)}` : ""}`;
}

export function ActivityForm({
  titleRef,
  section,
  expensePeople = [],
  expenseUserID,
  initialValue,
  initialDate,
  initialStartsAt,
  initialPlace,
  tripZone,
  tripID,
  tripStart,
  tripEnd,
  tripStartsAt,
  tripEndsAt,
  onSubmit,
  onCancel,
  onDirty,
  pending,
  error,
}: {
  section?: "details" | "place" | "notes" | "checklist";
  expensePeople?: ExpensePerson[];
  expenseUserID?: number;
  initialValue?: ActivityInput & { id?: number };
  initialPlace?: Place | null;
  tripZone: string;
  tripID: number;
  initialDate?: string;
  initialStartsAt?: string;
  titleRef?: Ref<HTMLInputElement>;
  tripStart: string;
  tripEnd: string;
  tripStartsAt: string | null;
  tripEndsAt: string | null;
  onSubmit: (input: ActivityInput, requestKey?: string) => void;
  onCancel: () => void;
  onDirty?: () => void;
  pending: boolean;
  error: unknown;
}) {
  const prefix = useId();
  const hideDate = !!initialDate && !initialValue;
  const [expenseChanges, setExpenseChanges] = useState<CostChange[]>([]);
  // A failed response may already have committed, so edits must keep the submission key.
  const requestKey = useRef("");
  function markDirty() {
    onDirty?.();
  }
  const api = useApi();
  const [title, setTitle] = useState(initialValue?.title ?? "");
  const [notes, setNotes] = useState(initialValue?.notes ?? "");
  const savedCategory = initialValue?.category ?? "Activity";
  const [categoryChoice, setCategoryChoice] = useState<string>(
    activityCategories.some((category) => category === savedCategory)
      ? savedCategory
      : "custom",
  );
  const [customCategory, setCustomCategory] = useState(
    categoryChoice === "custom" ? savedCategory : "",
  );
  const checklistKey = useRef(initialValue?.checklist?.length ?? 0);
  const checklistAddButton = useRef<HTMLButtonElement>(null);
  const [checklist, setChecklist] = useState(() =>
    (initialValue?.checklist ?? []).map((item, key) => ({ ...item, key })),
  );
  const [startTime, setStartTime] = useState(() =>
    initialValue
      ? instantToLocal(initialValue.starts_at, tripZone)
      : initialStartsAt
        ? instantToLocal(initialStartsAt, tripZone)
        : {
            value: initialDate ? `${initialDate}T` : "",
            occurrence: "" as Occurrence,
          },
  );
  const [duration, setDuration] = useState<Duration>(() => {
    if (!initialValue) return "60";
    const minutes = Number(
      (Temporal.Instant.from(initialValue.ends_at).epochNanoseconds -
        Temporal.Instant.from(initialValue.starts_at).epochNanoseconds) /
        BigInt(60_000_000_000),
    );
    return String(minutes) in durations &&
      Temporal.Instant.from(initialValue.starts_at)
        .add({ minutes })
        .equals(Temporal.Instant.from(initialValue.ends_at))
      ? (String(minutes) as Duration)
      : "custom";
  });
  const [customHours, setCustomHours] = useState(() =>
    initialValue
      ? String(
          Temporal.Instant.from(initialValue.starts_at)
            .until(initialValue.ends_at)
            .total("hours"),
        )
      : "",
  );
  const [timeChanged, setTimeChanged] = useState(false);
  const [validationError, setValidationError] = useState<string>();
  const [place, setPlace] = useState<Place | null>(initialPlace ?? null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceCandidate[] | null>(null);
  const [placeError, setPlaceError] = useState<unknown>(null);
  const [placePending, setPlacePending] = useState(false);
  // A new activity shows optional inputs only when asked; opened sections stay open.
  const [placeOpen, setPlaceOpen] = useState(!!initialPlace);
  const [notesOpen, setNotesOpen] = useState(!!initialValue?.notes);
  let interval: { start: string; end: string } | null = null;
  let intervalError: unknown;
  try {
    const start =
      initialValue && !timeChanged
        ? initialValue.starts_at
        : localToInstant(startTime.value, tripZone, startTime.occurrence);
    const hours = Number(customHours);
    if (duration === "custom" && (!Number.isFinite(hours) || hours <= 0))
      throw new Error("Enter a duration greater than 0 hours.");
    const end =
      initialValue && !timeChanged
        ? initialValue.ends_at
        : duration === "custom"
          ? Temporal.Instant.from(start)
              .add({ milliseconds: Math.round(hours * 3_600_000) })
              .toString()
          : endAfterMinutes(start, durations[duration]);
    if (Temporal.Instant.compare(end, start) <= 0)
      throw new Error("Activity end must be after start.");
    interval = { start, end };
  } catch (cause) {
    intervalError = cause;
  }
  const overlaps = useQuery({
    queryKey: [
      "trip",
      tripID,
      "overlaps",
      interval?.start,
      interval?.end,
      initialValue?.id ?? 0,
    ],
    enabled: interval !== null,
    queryFn: () =>
      api<
        Array<{ id: number; title: string; starts_at: string; ends_at: string }>
      >(
        `/api/v1/trips/${tripID}/activities/overlaps?starts_at=${encodeURIComponent(interval!.start)}&ends_at=${encodeURIComponent(interval!.end)}&exclude_id=${initialValue?.id ?? 0}`,
      ),
    retry: false,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || placePending) return;
    try {
      if (!interval) throw intervalError;
      const category = (
        categoryChoice === "custom" ? customCategory : categoryChoice
      ).trim();
      const bytes = (value: string) => new TextEncoder().encode(value).length;
      if (
        (!section || section === "details") &&
        (!category || bytes(category) > 100)
      )
        throw new Error("Enter a short category name.");
      if ((!section || section === "checklist") && checklist.length > 50)
        throw new Error("Use at most 50 to-do items.");
      if (
        (!section || section === "checklist") &&
        checklist.some(
          (item) => !item.text.trim() || bytes(item.text.trim()) > 200,
        )
      )
        throw new Error("Give every to-do item a short description.");
      const input: ActivityInput = {
        title,
        ...(expenseChanges.length
          ? {
              expense_changes: expenseChanges.map((c) => ({
                ...c,
                id: c.id && c.id > 0 ? c.id : undefined,
              })),
            }
          : {}),
        notes,
        time_zone: tripZone,
        place_id: place?.id ?? null,
        category,
        checklist: checklist.map((item): ChecklistItem => ({
          text: item.text.trim(),
          done: item.done,
        })),
        starts_at: interval.start,
        ends_at: interval.end,
      };
      if (
        tripStartsAt &&
        (Temporal.Instant.compare(input.starts_at, tripStartsAt) < 0 ||
          Temporal.Instant.compare(input.ends_at, tripEndsAt!) > 0)
      )
        throw new Error(
          "Activity must fit within the trip's start and end times.",
        );
      if (
        !tripStartsAt &&
        (startTime.value.slice(0, 10) < tripStart ||
          instantToLocal(input.ends_at, tripZone).value.slice(0, 10) > tripEnd)
      )
        throw new Error("Activity dates must fit within the trip dates.");
      setValidationError(undefined);
      if (!requestKey.current) requestKey.current = crypto.randomUUID();
      onSubmit(input, requestKey.current);
    } catch (cause) {
      setValidationError(
        cause instanceof Error ? cause.message : "Check the activity times.",
      );
    }
  }

  async function search() {
    if (placePending) return;
    const term = query.trim();
    const size = new TextEncoder().encode(term).length;
    if (size < 2 || size > 200) {
      setPlaceError(
        new ApiError(
          400,
          size < 2
            ? "Enter at least 2 characters to search."
            : "Use a shorter place name.",
        ),
      );
      return;
    }
    setPlacePending(true);
    setPlaceError(null);
    setResults(null);
    try {
      const found = await api<PlaceCandidate[]>(
        `/api/v1/places/search?q=${encodeURIComponent(term)}`,
      );
      setResults(found ?? []);
    } catch (cause) {
      setPlaceError(cause);
    } finally {
      setPlacePending(false);
    }
  }

  async function choose(candidate: PlaceCandidate) {
    if (placePending) return;
    setPlacePending(true);
    setPlaceError(null);
    try {
      const selected = await api<Place>("/api/v1/places/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_place_id: candidate.provider_place_id,
        }),
      });
      if (!selected)
        throw new ApiError(500, "Unable to save the place. Please try again.");
      setPlace(selected);
      setResults(null);
      markDirty();
    } catch (cause) {
      setPlaceError(cause);
    } finally {
      setPlacePending(false);
    }
  }

  const addPill = (label: string, onClick: () => void) => (
    <Button
      type="button"
      variant="secondary"
      className="min-h-11 rounded-full"
      aria-label={`Add ${label.toLowerCase()}`}
      onClick={onClick}
    >
      <Plus aria-hidden="true" className="size-3.5" />
      {label}
    </Button>
  );
  const addChecklistItem = (pill: boolean) => (
    <Button
      ref={checklistAddButton}
      type="button"
      variant={pill ? "secondary" : "link"}
      className={pill ? "min-h-11 rounded-full" : "min-h-11 px-0"}
      aria-label={pill ? "Add to do" : undefined}
      disabled={checklist.length >= 50}
      onClick={() => {
        setChecklist([
          ...checklist,
          { key: checklistKey.current++, text: "", done: false },
        ]);
        markDirty();
      }}
    >
      <Plus aria-hidden="true" className="size-3.5" />
      {pill ? "To do" : "Add to-do item"}
    </Button>
  );
  const categoryField = (
    <div className="space-y-2">
      <fieldset className="activity-category-chips">
        <legend className="mb-2 text-sm leading-none font-medium">
          Category
        </legend>
        {[...activityCategories, "Custom"].map((category) => {
          const value = category === "Custom" ? "custom" : category;
          const Icon = Object.hasOwn(activityCategoryIcons, category)
            ? activityCategoryIcons[category]
            : Tag;
          return (
            <label
              key={category}
              className="activity-category activity-category-chip"
              data-category={category}
            >
              <input
                type="radio"
                className="sr-only"
                name={`${prefix}-category`}
                value={value}
                checked={categoryChoice === value}
                onChange={() => {
                  setCategoryChoice(value);
                  markDirty();
                }}
              />
              <Icon aria-hidden="true" className="size-3.5 shrink-0" />
              {category}
            </label>
          );
        })}
      </fieldset>
      {categoryChoice === "custom" && (
        <div className="space-y-2">
          <Label
            htmlFor={`${prefix}-custom-category`}
            className="field-required"
          >
            Custom category
          </Label>
          <Input
            id={`${prefix}-custom-category`}
            required
            value={customCategory}
            placeholder="e.g. Shopping"
            onChange={(event) => setCustomCategory(event.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            This label belongs to this activity.
          </p>
        </div>
      )}
    </div>
  );

  const whenSummary = `${
    interval
      ? `Ends ${formatEndTime(interval.end, tripZone, startTime.value.slice(0, 10))} · `
      : ""
  }${tripZone}`;
  return (
    <form
      onSubmit={submit}
      onChangeCapture={(event) => {
        if (
          event.target instanceof HTMLElement &&
          !event.currentTarget.contains(event.target)
        )
          return;
        markDirty();
      }}
      className={
        section
          ? "activity-section-form"
          : "activity-form activity-planning-form"
      }
    >
      <fieldset
        disabled={pending || placePending}
        className="min-w-0 space-y-5"
      >
        {(!section || section === "details") && (
          <>
            {section && categoryField}
            <div className="space-y-2">
              <Label htmlFor={`${prefix}-title`} className="field-required">
                Activity name
              </Label>
              <Input
                ref={titleRef}
                autoFocus={section === "details"}
                placeholder="e.g. Dinner at the waterfront"
                id={`${prefix}-title`}
                className="min-h-11"
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            {!section && categoryField}
            <div
              className="activity-when-editor"
              role="group"
              aria-labelledby={`${prefix}-when`}
            >
              <p
                id={`${prefix}-when`}
                className={hideDate ? "sr-only" : "activity-when-label"}
              >
                {hideDate
                  ? new Intl.DateTimeFormat(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      timeZone: "UTC",
                    }).format(new Date(`${initialDate}T12:00:00Z`))
                  : "When"}
              </p>
              <div className="activity-when-fields space-y-5">
                <div className="min-w-0 space-y-2">
                  <DateTimeField
                    id={`${prefix}-start`}
                    label="Start"
                    zone={tripZone}
                    draft={startTime}
                    split
                    required
                    hideDate={hideDate}
                    minDate={tripStart}
                    maxDate={tripEnd}
                    disabled={pending}
                    onChange={(next) => {
                      setStartTime(next);
                      setTimeChanged(true);
                      setValidationError(undefined);
                      markDirty();
                    }}
                  />
                  <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                    <Clock className="mt-0.5 size-4 shrink-0" />
                    <span className="min-w-0 wrap-break-word">
                      {whenSummary}
                    </span>
                  </p>
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor={`${prefix}-duration`}
                    className="field-required"
                  >
                    Duration
                  </Label>
                  <Select
                    value={duration}
                    onValueChange={(value) => {
                      if (
                        value === "30" ||
                        value === "60" ||
                        value === "120" ||
                        value === "custom"
                      ) {
                        setDuration(value);
                        setTimeChanged(true);
                        setValidationError(undefined);
                        markDirty();
                      }
                    }}
                  >
                    <SelectTrigger
                      id={`${prefix}-duration`}
                      className="min-h-11 w-full"
                    >
                      <SelectValue>
                        {duration === "30"
                          ? "30 minutes"
                          : duration === "60"
                            ? "1 hour"
                            : duration === "120"
                              ? "2 hours"
                              : "Custom duration"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                      <SelectItem value="custom">Custom duration</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {duration === "custom" && (
                  <div className="space-y-2">
                    <Label
                      htmlFor={`${prefix}-custom-hours`}
                      className="field-required"
                    >
                      Duration (hours)
                    </Label>
                    <Input
                      id={`${prefix}-custom-hours`}
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      required
                      value={customHours}
                      placeholder="e.g. 1.5"
                      onChange={(event) => {
                        setCustomHours(event.target.value);
                        setTimeChanged(true);
                        setValidationError(undefined);
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
            {interval &&
              (overlaps.isPending ? (
                <p role="status" className="text-sm">
                  Checking other activities…
                </p>
              ) : overlaps.isError ? (
                <TripError
                  error={overlaps.error}
                  retry={() => void overlaps.refetch()}
                />
              ) : overlaps.data && overlaps.data.length > 0 ? (
                <Alert>
                  <AlertDescription>
                    Overlaps{" "}
                    {overlaps.data.map((item) => item.title).join(", ")}.
                    Parallel activities are allowed.
                  </AlertDescription>
                </Alert>
              ) : null)}
          </>
        )}
        {(section
          ? section !== "details"
          : placeOpen || notesOpen || checklist.length > 0) && (
          <div
            className={
              section ? "activity-more-details" : "activity-detail-notes"
            }
          >
            {(section === "place" || (!section && placeOpen)) && (
              <section className={section ? "space-y-2" : undefined}>
                <div className="activity-section-heading">
                  <h3>Place</h3>
                </div>
                <div className="space-y-3 pt-4">
                  <Label htmlFor={`${prefix}-place-search`} className="sr-only">
                    Search for a place (optional)
                  </Label>
                  {place && (
                    <div className="rounded-xl border bg-secondary/40 p-4 text-sm">
                      <p className="font-medium">{place.name}</p>
                      <p className="break-words text-muted-foreground">
                        {place.address}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-2 min-h-11"
                        onClick={() => {
                          setPlace(null);
                          markDirty();
                        }}
                      >
                        Clear place
                      </Button>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Input
                      id={`${prefix}-place-search`}
                      autoFocus={!section || section === "place"}
                      className="min-h-11 min-w-0 flex-1"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" &&
                          !event.nativeEvent.isComposing
                        ) {
                          event.preventDefault();
                          void search();
                        }
                      }}
                      placeholder="Search for a place"
                      enterKeyHint="search"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      onClick={() => void search()}
                    >
                      {placePending ? "Loading…" : "Search"}
                    </Button>
                  </div>
                  {results && (
                    <div aria-live="polite">
                      {results.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No places found.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {results.map((candidate) => (
                            <li key={candidate.provider_place_id}>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-auto min-h-11 w-full justify-start whitespace-normal text-left"
                                onClick={() => void choose(candidate)}
                              >
                                <span>
                                  <strong>{candidate.name}</strong>
                                  <br />
                                  <span className="text-muted-foreground">
                                    {candidate.address}
                                  </span>
                                </span>
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  {!!placeError && <TripError error={placeError} />}
                  <p className="text-xs text-muted-foreground">
                    Searches run only when you press Search. Place data ©{" "}
                    <a
                      className="underline"
                      href="https://www.openstreetmap.org/copyright"
                      target="_blank"
                      rel="noreferrer"
                    >
                      OpenStreetMap contributors
                    </a>
                    .
                  </p>
                </div>
              </section>
            )}
            {(section === "notes" || (!section && notesOpen)) && (
              <section className={section ? "space-y-2" : undefined}>
                <div className="activity-section-heading">
                  <h3>Notes</h3>
                </div>
                <div className="pt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`${prefix}-notes`}>Activity notes</Label>
                    <textarea
                      id={`${prefix}-notes`}
                      autoFocus={!section || section === "notes"}
                      rows={3}
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      className="w-full min-w-0 rounded-lg border border-input bg-card px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/30 disabled:opacity-50"
                    />
                  </div>
                </div>
              </section>
            )}
            {(section === "checklist" ||
              (!section && checklist.length > 0)) && (
              <section className={section ? "space-y-2" : undefined}>
                <div className="activity-section-heading">
                  <h3 id={`${prefix}-checklist-label`}>To do</h3>
                </div>
                <div
                  className="space-y-3 pt-4"
                  role="group"
                  aria-labelledby={`${prefix}-checklist-label`}
                >
                  {section && (
                    <p className="text-sm text-muted-foreground">
                      A simple list of things to do during this activity.
                    </p>
                  )}
                  <ol className="space-y-3">
                    {checklist.map((item, index) => (
                      <li
                        key={item.key}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <Input
                          className="min-h-11 min-w-0 flex-1 basis-32"
                          aria-label={`To-do item ${index + 1}`}
                          autoFocus={
                            !section || (section === "checklist" && index === 0)
                          }
                          required
                          value={item.text}
                          placeholder="e.g. Buy tickets"
                          onChange={(event) =>
                            setChecklist(
                              checklist.map((current) =>
                                current.key === item.key
                                  ? { ...current, text: event.target.value }
                                  : current,
                              ),
                            )
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          className="min-h-11"
                          aria-label={`Remove to-do item ${index + 1}`}
                          onClick={() => {
                            setChecklist(
                              checklist.filter(
                                (current) => current.key !== item.key,
                              ),
                            );
                            markDirty();
                            requestAnimationFrame(() =>
                              checklistAddButton.current?.focus(),
                            );
                          }}
                        >
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ol>
                  {addChecklistItem(false)}
                  <p className="text-xs text-muted-foreground">
                    {checklist.length}/50 items
                  </p>
                </div>
              </section>
            )}
          </div>
        )}
        {!section && (
          <div className="activity-add-more" role="group" aria-label="Add more">
            {(!placeOpen ||
              !notesOpen ||
              !checklist.length ||
              !expenseChanges.length) && (
              <p aria-hidden="true" className="activity-add-more-label">
                Add more
              </p>
            )}
            {!placeOpen && addPill("Place", () => setPlaceOpen(true))}
            {!notesOpen && addPill("Notes", () => setNotesOpen(true))}
            {!checklist.length && addChecklistItem(true)}
            <ActivityExpenseDrafts
              tripID={tripID}
              activityID={initialValue?.id}
              title={title}
              zone={tripZone}
              people={expensePeople}
              userID={expenseUserID}
              changes={expenseChanges}
              pending={pending}
              onChange={(changes) => {
                setExpenseChanges(changes);
                markDirty();
              }}
            />
          </div>
        )}
      </fieldset>
      {validationError && (
        <Alert variant="destructive">
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}
      {!!error && <TripError error={error} />}
      <div className="form-actions">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="min-h-11"
          disabled={pending || placePending}
        >
          {pending ? "Saving…" : section ? "Save" : "Save activity"}
        </Button>
      </div>
    </form>
  );
}
