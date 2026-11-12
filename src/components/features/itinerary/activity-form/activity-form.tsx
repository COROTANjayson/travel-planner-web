"use client";

import { cn } from "@/lib/utils";
import { fieldRequired } from "@/components/shared/field-required";
import { useId, useRef, useState, type Ref, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Temporal } from "@js-temporal/polyfill";
import { Plus } from "lucide-react";
import { ApiError, useApi } from "@/lib/api";
import {
  activityCategories,
  type ActivityInput,
  type ChecklistItem,
} from "@/lib/itinerary";
import { type Place, type PlaceCandidate } from "@/lib/places";
import {
  endAfterMinutes,
  instantToLocal,
  localToInstant,
  timeLabel,
  type Occurrence,
} from "@/lib/activity-time";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TripError } from "@/components/shared/trip-states";

import type { CostChange, ExpensePerson } from "@/lib/expenses";
import { ActivityExpenseDrafts } from "@/components/features/expenses/activity-expense-drafts";
import { CategoryField } from "@/components/features/itinerary/activity-form/category-field";
import { ChecklistSection } from "@/components/features/itinerary/activity-form/checklist-section";
import { NotesSection } from "@/components/features/itinerary/activity-form/notes-section";
import { OverlapNotice } from "@/components/features/itinerary/activity-form/overlap-notice";
import { PlaceSection } from "@/components/features/itinerary/activity-form/place-section";
import { WhenEditor } from "@/components/features/itinerary/activity-form/when-editor";

const durations = { "30": 30, "60": 60, "120": 120 } as const;
export type Duration = keyof typeof durations | "custom";

function formatEndTime(instant: string, zone: string, startDate: string) {
  const local = instantToLocal(instant, zone).value;
  const time = timeLabel(instant, zone);
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
  pending: boolean;
  error: unknown;
}) {
  const prefix = useId();
  const hideDate = !!initialDate && !initialValue;
  const [expenseChanges, setExpenseChanges] = useState<CostChange[]>([]);
  // A failed response may already have committed, so edits must keep the submission key.
  const requestKey = useRef("");
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
      }}
    >
      <Plus aria-hidden="true" className="size-3.5" />
      {pill ? "To do" : "Add to-do item"}
    </Button>
  );
  const categoryField = (
    <CategoryField
      prefix={prefix}
      categoryChoice={categoryChoice}
      setCategoryChoice={setCategoryChoice}
      customCategory={customCategory}
      setCustomCategory={setCustomCategory}
    />
  );

  const whenSummary = `${
    interval
      ? `Ends ${formatEndTime(interval.end, tripZone, startTime.value.slice(0, 10))} · `
      : ""
  }${tripZone}`;
  return (
    <form
      onSubmit={submit}
      className={
        section
          ? "activity-section-form"
          : "activity-form activity-planning-form flex flex-1 flex-col [&_label]:text-sm [&_label]:leading-[22px] [&_label]:font-normal [&_label]:text-muted-foreground"
      }
    >
      <fieldset
        disabled={pending || placePending}
        className={cn(
          "min-w-0 space-y-5",
          section ? "[&>:first-child_input]:[font-size:1rem]" : "flex-1 pb-6",
        )}
      >
        {(!section || section === "details") && (
          <>
            {section && categoryField}
            <div className="space-y-2">
              <Label htmlFor={`${prefix}-title`} className={fieldRequired}>
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
            <WhenEditor
              prefix={prefix}
              hideDate={hideDate}
              initialDate={initialDate}
              tripZone={tripZone}
              tripStart={tripStart}
              tripEnd={tripEnd}
              pending={pending}
              startTime={startTime}
              setStartTime={setStartTime}
              setTimeChanged={setTimeChanged}
              setValidationError={setValidationError}
              whenSummary={whenSummary}
              duration={duration}
              setDuration={setDuration}
              customHours={customHours}
              setCustomHours={setCustomHours}
              planning={!section}
            />
            {interval && <OverlapNotice overlaps={overlaps} />}
          </>
        )}
        {(section
          ? section !== "details"
          : placeOpen || notesOpen || checklist.length > 0) && (
          <div
            className={
              section
                ? "text-[12px] text-muted-foreground"
                : "activity-detail-notes mt-2"
            }
          >
            {(section === "place" || (!section && placeOpen)) && (
              <PlaceSection
                prefix={prefix}
                section={section}
                place={place}
                setPlace={setPlace}
                query={query}
                setQuery={setQuery}
                search={search}
                choose={choose}
                results={results}
                placePending={placePending}
                placeError={placeError}
              />
            )}
            {(section === "notes" || (!section && notesOpen)) && (
              <NotesSection
                prefix={prefix}
                section={section}
                notes={notes}
                setNotes={setNotes}
              />
            )}
            {(section === "checklist" ||
              (!section && checklist.length > 0)) && (
              <ChecklistSection
                prefix={prefix}
                section={section}
                checklist={checklist}
                setChecklist={setChecklist}
                checklistAddButtonRef={checklistAddButton}
                addButton={addChecklistItem(false)}
              />
            )}
          </div>
        )}
        {!section && (
          <div
            className="activity-add-more flex flex-wrap items-center gap-2"
            role="group"
            aria-label="Add more"
          >
            {(!placeOpen ||
              !notesOpen ||
              !checklist.length ||
              !expenseChanges.length) && (
              <p
                aria-hidden="true"
                className="basis-full text-sm leading-[22px] text-muted-foreground"
              >
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
              onChange={setExpenseChanges}
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
      <div className="form-actions sticky bottom-0 z-10 flex flex-wrap gap-3 border-t border-border bg-[var(--form-surface,var(--background))] py-4 [.activity-form_>_&]:[justify-content:flex-end] [.activity-form_>_&]:[margin-inline:-1.5rem] [.activity-form_>_&]:[padding-inline:1.5rem] [.activity-form_>_&_>_:first-child]:[flex:0_1_auto] max-md:[&_>_*]:[min-width:0] max-md:[&_>_*]:[white-space:normal] max-md:[&_>_:first-child]:[flex:1_1_10rem] [.activity-planning-form_>_&]:[padding-bottom:max(1rem,_env(safe-area-inset-bottom))] [.activity-planning-form_>_&]:[background:var(--background)] [.activity-section-form_>_&]:[position:static] [.activity-section-form_>_&]:[justify-content:flex-end] [.activity-section-form_>_&]:[margin-top:16px] [.activity-section-form_>_&]:[padding:0] [.activity-section-form_>_&]:[border-top:0] [.activity-section-form_>_&]:[background:transparent] [.activity-section-form_>_&_>_[data-slot='button']]:[flex:0_0_6rem] [.activity-section-form_>_&_>_[data-slot='button']]:[width:6rem] [.activity-section-form_>_&_>_[data-slot='button']]:[min-height:44px] [.activity-section-form_>_&_>_[data-slot='button']]:[border-radius:0.75rem]">
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
