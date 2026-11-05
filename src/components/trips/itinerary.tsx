"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { ActivityExpenses, type ActivityExpenseView } from "./expenses";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Temporal } from "@js-temporal/polyfill";
import { TZDate } from "react-day-picker";
import {
  MapPin,
  CalendarCheck,
  CalendarDays,
  SlidersHorizontal,
  ChevronRight,
  Plus,
  Coffee,
  Utensils,
  Plane,
  Sparkles,
  Tag,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { TripDialog } from "./trip-dialog";
import { ApiError } from "@/lib/api";
import {
  type Activity,
  type ActivityConflict,
  useItineraryApi,
} from "@/lib/itinerary";
import {
  formatActivityDuration,
  formatActivityTime,
} from "@/lib/activity-time";
import { participantName, type Participant } from "@/lib/memberships";
import { type Trip } from "@/lib/trips";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ActivityForm } from "./activity-form";
import { TripError } from "./trip-states";

const TripMap = dynamic(() => import("./trip-map"), {
  ssr: false,
  loading: () => <p role="status">Loading map…</p>,
});

const categoryIcons: Record<string, LucideIcon> = {
  Rest: Coffee,
  Eating: Utensils,
  Travel: Plane,
  Activity: Sparkles,
};

function CategoryBadge({ category }: { category: string }) {
  const Icon = Object.hasOwn(categoryIcons, category)
    ? categoryIcons[category]
    : Tag;
  return (
    <span className="activity-category" data-category={category}>
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="min-w-0 break-words">{category}</span>
    </span>
  );
}

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const dateLabel = (date: string) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
const timeLabel = (instant: string, zone: string) =>
  new Intl.DateTimeFormat(undefined, {
    timeZone: zone,
    timeStyle: "short",
  }).format(new Date(instant));
const localDate = (instant: string, zone: string) =>
  Temporal.Instant.from(instant)
    .toZonedDateTimeISO(zone)
    .toPlainDate()
    .toString();
const boundary = (date: string, zone: string) =>
  Temporal.PlainDate.from(date)
    .toZonedDateTime({ timeZone: zone, plainTime: "00:00" })
    .toInstant()
    .toString();
const moveDate = (date: string, days: number) =>
  Temporal.PlainDate.from(date).add({ days }).toString();

function visibleDates(start: string, end: string, selected: string) {
  const offset = Temporal.PlainDate.from(selected).since(
    Temporal.PlainDate.from(start),
  ).days;
  const anchor = moveDate(start, Math.floor(offset / 7) * 7);
  return Array.from({ length: 7 }, (_, index) =>
    moveDate(anchor, index),
  ).filter((date) => date <= end);
}

export function Itinerary({
  trip,
  participants,
  canEdit,
  current,
  onFailure,
  initialDate,
  onDateChange,
}: {
  initialDate?: string;
  onDateChange?: (date: string) => void;
  trip: Trip;
  participants?: Participant[];
  canEdit: boolean;
  current?: Participant;
  onFailure: (error: Error) => void | Promise<void>;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const requestedActivity = Number(params.get("activity")) || null;
  const api = useItineraryApi(trip.id, onFailure);
  const [selectedDate, setSelectedDate] = useState(() => {
    if (initialDate) return initialDate;
    const today = Temporal.Now.zonedDateTimeISO(trip.time_zone)
      .toPlainDate()
      .toString();
    return today >= trip.start_date && today <= trip.end_date
      ? today
      : trip.start_date;
  });
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [conflictsOpen, setConflictsOpen] = useState(false);
  const [editing, setEditing] = useState<
    | (Activity & { showMoreDetails?: boolean })
    | { date: string; startsAt?: string }
    | null
  >(null);
  const [editDirty, setEditDirty] = useState(false);
  const titleInput = useRef<HTMLInputElement>(null);
  const editTrigger = useRef<HTMLButtonElement | null>(null);
  const selectedHeading = useRef<HTMLHeadingElement>(null);
  const [deleting, setDeleting] = useState<Activity | null>(null);
  const [viewing, setViewing] = useState<number | null>(requestedActivity);
  const detailTrigger = useRef<HTMLButtonElement | null>(null);
  const dayRail = useRef<HTMLDivElement>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [dayOptionsOpen, setDayOptionsOpen] = useState(false);
  const dayOptionsTrigger = useRef<HTMLButtonElement>(null);
  const dayToolTrigger = useRef<HTMLButtonElement | null>(null);
  const [expenseView, setExpenseView] =
    useState<ActivityExpenseView>("overview");
  const [expenseActivity, setExpenseActivity] = useState(viewing);
  const detailContent = useRef<HTMLDivElement>(null);
  const financeScroll = useRef<Partial<Record<ActivityExpenseView, number>>>(
    {},
  );
  const financeFocus = useRef<string | null>(null);
  if (expenseActivity !== viewing) {
    setExpenseActivity(viewing);
    setExpenseView("overview");
  }
  function navigateExpenses(next: ActivityExpenseView) {
    const reader = detailContent.current?.closest(
      "[data-slot='trip-dialog-reader']",
    );
    financeScroll.current[expenseView] = reader?.scrollTop ?? 0;
    financeFocus.current =
      next === "overview"
        ? "[data-finance-link='details']"
        : expenseView === "loans" && next === "details"
          ? "[data-finance-link='loans']"
          : null;
    setExpenseView(next);
  }
  useEffect(() => {
    financeScroll.current = {};
  }, [viewing]);
  useEffect(() => {
    const reader = detailContent.current?.closest(
      "[data-slot='trip-dialog-reader']",
    );
    if (reader) reader.scrollTop = financeScroll.current[expenseView] ?? 0;
    if (financeFocus.current)
      detailContent.current
        ?.querySelector<HTMLElement>(financeFocus.current)
        ?.focus({ preventScroll: true });
    financeFocus.current = null;
  }, [expenseView, viewing]);
  function setSelected(date: string) {
    setViewing(null);
    setSelectedDate(date);
    onDateChange?.(date);
  }
  const selected =
    selectedDate < trip.start_date
      ? trip.start_date
      : selectedDate > trip.end_date
        ? trip.end_date
        : selectedDate;
  const dates = visibleDates(trip.start_date, trip.end_date, selected);
  useEffect(() => {
    const rail = dayRail.current;
    const current = rail?.querySelector<HTMLElement>('[aria-current="date"]');
    if (rail && current && rail.scrollWidth > rail.clientWidth) {
      rail.scrollTo({
        left:
          current.offsetLeft -
          rail.offsetLeft -
          (rail.clientWidth - current.clientWidth) / 2,
      });
    }
  }, [selected]);
  const from = boundary(dates[0], trip.time_zone);
  const before = boundary(moveDate(dates[dates.length - 1], 1), trip.time_zone);
  const activities = useQuery({
    queryKey: ["trip", trip.id, "activities", "board", from, before],
    queryFn: ({ signal }) => api.listRange(from, before, signal),
    retry: false,
  });
  const conflicts = useQuery({
    queryKey: ["trip", trip.id, "conflicts", "all"],
    queryFn: ({ signal }) => api.conflicts(signal),
    retry: false,
  });
  const dayStart = boundary(selected, trip.time_zone);
  const dayEnd = boundary(moveDate(selected, 1), trip.time_zone);
  const dayConflicts =
    conflicts.data?.filter(
      (conflict) =>
        Temporal.Instant.compare(conflict.overlap_starts_at, dayEnd) < 0 &&
        Temporal.Instant.compare(conflict.overlap_ends_at, dayStart) > 0,
    ) ?? [];
  useEffect(() => {
    const failure = [activities.error, conflicts.error].find(
      (error) => error instanceof ApiError && error.status === 404,
    );
    if (failure) void onFailure(failure);
  }, [activities.error, conflicts.error, onFailure]);
  const unavailable = [activities.error, conflicts.error].some(
    (error) => error instanceof ApiError && error.status === 404,
  );
  const linkedActivity = useQuery({
    queryKey: ["trip", trip.id, "activity", viewing],
    enabled: viewing !== null && viewing === requestedActivity,
    queryFn: ({ signal }) => api.get(viewing!, signal),
    retry: false,
  });
  const [lastRequested, setLastRequested] = useState(requestedActivity);
  if (lastRequested !== requestedActivity) {
    setLastRequested(requestedActivity);
    setViewing(requestedActivity);
  }
  const viewedActivity =
    !unavailable && !activities.isError
      ? (activities.data?.find((activity) => activity.id === viewing) ??
        (viewing !== null && viewing === requestedActivity
          ? linkedActivity.data
          : undefined))
      : undefined;
  if (
    viewing !== null &&
    !activities.isPending &&
    !viewedActivity &&
    (requestedActivity === null || linkedActivity.isError)
  )
    setViewing(null);
  const viewedCreator = participants?.find(
    (person) => person.user_id === viewedActivity?.created_by_user_id,
  );
  const returnFocus = (trigger: HTMLButtonElement | null) =>
    trigger?.isConnected && !trigger.disabled && trigger.getClientRects().length
      ? trigger
      : selectedHeading.current;
  const editedActivity = editing && "id" in editing ? editing : null;
  const newDate = editing && "date" in editing ? editing.date : undefined;
  const [year, month, day] = selected.split("-").map(Number);
  const today = Temporal.Now.zonedDateTimeISO(trip.time_zone)
    .toPlainDate()
    .toString();
  const dayNumber =
    Temporal.PlainDate.from(selected).since(
      Temporal.PlainDate.from(trip.start_date),
    ).days + 1;
  const dayCount =
    Temporal.PlainDate.from(trip.end_date).since(
      Temporal.PlainDate.from(trip.start_date),
    ).days + 1;
  const selectedActivities = (activities.data ?? [])
    .filter(
      (activity) => localDate(activity.starts_at, trip.time_zone) === selected,
    )
    .sort((a, b) => Temporal.Instant.compare(a.starts_at, b.starts_at));
  function addActivity(date: string, trigger: HTMLButtonElement) {
    const dayActivities =
      activities.data?.filter(
        (activity) => localDate(activity.starts_at, trip.time_zone) === date,
      ) ?? [];
    const latestEnd = dayActivities.reduce<string | undefined>(
      (latest, activity) =>
        !latest || Temporal.Instant.compare(activity.ends_at, latest) > 0
          ? activity.ends_at
          : latest,
      undefined,
    );
    editTrigger.current = trigger;
    api.reset();
    setEditDirty(false);
    setEditing({
      date,
      startsAt:
        latestEnd && localDate(latestEnd, trip.time_zone) === date
          ? latestEnd
          : undefined,
    });
  }
  const closeEditor = () => {
    if (api.pending) return;
    if (editDirty && !window.confirm("Discard your unsaved activity changes?"))
      return;
    api.reset();
    setEditDirty(false);
    if (editedActivity) setViewing(editedActivity.id);
    setEditing(null);
  };

  const dayTools = (
    <nav
      aria-label={`Tools for ${dateLabel(selected)}`}
      className="flex flex-wrap gap-1"
    >
      {today >= trip.start_date &&
        today <= trip.end_date &&
        selected !== today && (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 px-2"
            onClick={() => {
              setDayOptionsOpen(false);
              setSelected(today);
            }}
          >
            <CalendarDays aria-hidden="true" />
            Today
          </Button>
        )}
      <Button
        variant="ghost"
        className="min-h-11 px-2"
        onClick={(event) => {
          dayToolTrigger.current = dayOptionsOpen
            ? dayOptionsTrigger.current
            : event.currentTarget;
          setDayOptionsOpen(false);
          setMapOpen(true);
        }}
      >
        <MapPin aria-hidden="true" />
        View map
      </Button>
      <Button
        variant="ghost"
        className="min-h-11 px-2"
        onClick={(event) => {
          dayToolTrigger.current = dayOptionsOpen
            ? dayOptionsTrigger.current
            : event.currentTarget;
          setDayOptionsOpen(false);
          setConflictsOpen(true);
        }}
      >
        <CalendarCheck aria-hidden="true" />
        Overlaps
        {(conflicts.isError || dayConflicts.length > 0) && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
            {conflicts.isError ? "Unavailable" : dayConflicts.length}
          </span>
        )}
      </Button>
    </nav>
  );
  const dayToolDialogs = (
    <>
      <TripDialog
        title={`Places on ${dateLabel(selected)}`}
        description="Places attached to activities on the selected day."
        open={mapOpen}
        onOpenChange={setMapOpen}
        finalFocus={() => returnFocus(dayToolTrigger.current)}
      >
        {activities.isPending ? (
          <p role="status">Loading places...</p>
        ) : activities.isError ? (
          <TripError
            error={activities.error}
            retry={() => void activities.refetch()}
          />
        ) : (
          <TripMap
            activities={activities.data.filter(
              (activity) =>
                localDate(activity.starts_at, trip.time_zone) === selected,
            )}
          />
        )}
      </TripDialog>
      <TripDialog
        title={`Conflicts on ${dateLabel(selected)}`}
        description="Overlapping activities on this day."
        open={conflictsOpen}
        onOpenChange={setConflictsOpen}
        finalFocus={() =>
          editing ? false : returnFocus(dayToolTrigger.current)
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Overlaps are advisory. Parallel activities are allowed. Overlap
            times below use {trip.time_zone}.
          </p>
          {conflicts.isPending ? (
            <p role="status">Loading conflicts…</p>
          ) : conflicts.isError ? (
            <TripError
              error={conflicts.error}
              retry={() => void conflicts.refetch()}
              pending={conflicts.isFetching}
            />
          ) : (
            <>
              {dayConflicts.length === 0 ? (
                <p className="text-muted-foreground">
                  No schedule conflicts on this day.
                </p>
              ) : (
                <ConflictList
                  trip={trip}
                  conflicts={dayConflicts}
                  loaded={activities.data ?? []}
                  onUnavailable={api.refresh}
                  onViewDay={(date) => {
                    setSelected(date);
                    setConflictsOpen(false);
                  }}
                  onEdit={
                    canEdit
                      ? (activity) => {
                          setConflictsOpen(false);
                          setEditDirty(false);
                          setEditing(activity);
                        }
                      : undefined
                  }
                />
              )}
            </>
          )}
        </div>
      </TripDialog>
    </>
  );

  return (
    <div className="coastal-itinerary flex min-w-0 flex-col gap-6">
      <section
        aria-labelledby="itinerary-heading"
        className="itinerary-workspace"
      >
        <nav className="itinerary-days" aria-label="Choose itinerary day">
          <p className="day-rail-label">Your days</p>
          <div className="day-rail" ref={dayRail}>
            {dates.map((date) => {
              const count = (activities.data ?? []).filter(
                (activity) =>
                  localDate(activity.starts_at, trip.time_zone) === date,
              ).length;
              return (
                <button
                  key={date}
                  type="button"
                  className="itinerary-day"
                  aria-current={date === selected ? "date" : undefined}
                  aria-label={`${dateLabel(date)}${date === today ? ", Today" : ""}`}
                  onClick={() => setSelected(date)}
                >
                  <span className="day-weekday">
                    {new Intl.DateTimeFormat(undefined, {
                      weekday: "short",
                      timeZone: "UTC",
                    }).format(new Date(`${date}T12:00:00Z`))}
                    {date === today && " · Today"}
                  </span>
                  <span className="day-number">{Number(date.slice(-2))}</span>
                  <span className="day-plan">
                    {activities.isSuccess
                      ? count
                        ? `${count} planned`
                        : "Open day"
                      : activities.isPending
                        ? "Loading…"
                        : "Unavailable"}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
        <div className="itinerary-agenda">
          <div className="itinerary-toolbar flex flex-wrap items-center justify-between gap-2">
            <h2 id="itinerary-heading" className="sr-only">
              Daily itinerary
            </h2>
            <div className="itinerary-day-heading">
              <h3
                id={`day-${selected}-heading`}
                ref={selectedHeading}
                tabIndex={-1}
                className="day-summary outline-none focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
              >
                <time dateTime={selected}>
                  {new Intl.DateTimeFormat(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    timeZone: "UTC",
                  }).format(new Date(`${selected}T12:00:00Z`))}
                </time>
              </h3>
              <p
                role="status"
                aria-live="polite"
                className="itinerary-day-meta"
              >
                Day {dayNumber} of {dayCount} ·{" "}
                {activities.isPending
                  ? "Loading activities…"
                  : activities.isError || unavailable
                    ? "Activities unavailable"
                    : `${selectedActivities.length} ${selectedActivities.length === 1 ? "activity" : "activities"} planned`}
              </p>
            </div>
            <TripDialog
              title="Choose a day"
              description={`Day ${dayNumber} of ${dayCount}`}
              mobilePresentation="sheet"
              open={datePickerOpen}
              onOpenChange={setDatePickerOpen}
              trigger={
                <Button
                  type="button"
                  variant="ghost"
                  className="day-picker"
                  aria-label={`Choose day, ${dateLabel(selected)}, day ${dayNumber} of ${dayCount}`}
                >
                  <CalendarDays aria-hidden="true" className="size-4" />
                  <span className="hidden md:inline">Choose day</span>
                </Button>
              }
            >
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  timeZone={trip.time_zone}
                  selected={new TZDate(year, month - 1, day, trip.time_zone)}
                  defaultMonth={
                    new TZDate(year, month - 1, day, trip.time_zone)
                  }
                  captionLayout="dropdown"
                  startMonth={
                    new TZDate(
                      Number(trip.start_date.slice(0, 4)),
                      Number(trip.start_date.slice(5, 7)) - 1,
                      1,
                      trip.time_zone,
                    )
                  }
                  endMonth={
                    new TZDate(
                      Number(trip.end_date.slice(0, 4)),
                      Number(trip.end_date.slice(5, 7)) - 1,
                      1,
                      trip.time_zone,
                    )
                  }
                  disabled={(date) =>
                    dateKey(date) < trip.start_date ||
                    dateKey(date) > trip.end_date
                  }
                  onSelect={(date) => {
                    if (date) {
                      setSelected(dateKey(date));
                      setDatePickerOpen(false);
                    }
                  }}
                />
              </div>
            </TripDialog>
            <div className="md:hidden">
              <TripDialog
                title="Day options"
                description={dateLabel(selected)}
                mobilePresentation="sheet"
                open={dayOptionsOpen}
                onOpenChange={setDayOptionsOpen}
                finalFocus={() =>
                  mapOpen || conflictsOpen ? false : dayOptionsTrigger.current
                }
                trigger={
                  <Button
                    variant="ghost"
                    className="size-11"
                    ref={dayOptionsTrigger}
                    aria-label="Day options"
                  >
                    <SlidersHorizontal aria-hidden="true" />
                  </Button>
                }
              >
                <div className="mobile-day-options">{dayTools}</div>
              </TripDialog>
            </div>
            {canEdit && !unavailable && activities.isSuccess && (
              <Button
                type="button"
                className="hidden md:inline-flex"
                disabled={api.pending || editing !== null}
                onClick={(event) => addActivity(selected, event.currentTarget)}
              >
                <Plus aria-hidden="true" />
                Add activity
              </Button>
            )}
          </div>
          <div className="itinerary-day-summary">
            <div className="hidden md:block">{dayTools}</div>
          </div>
          {dayToolDialogs}
          {api.error && !editing && !deleting && (
            <TripError error={api.error} />
          )}
          <TripDialog
            open={!!editing && canEdit}
            presentation="detail"
            className="activity-details-dialog expense-flow-dialog activity-planning-dialog"
            backLabel={
              editedActivity ? "Back to activity" : "Back to itinerary"
            }
            backdropClassName="bg-black/60"
            title={editedActivity ? "Edit activity" : "Add activity"}
            description="Add costs while planning your day."
            busy={api.pending}
            disablePointerDismissal
            initialFocus={titleInput}
            finalFocus={() => returnFocus(editTrigger.current)}
            onOpenChange={(open) => {
              if (!open) closeEditor();
            }}
          >
            {editing && (
              <ActivityForm
                titleRef={titleInput}
                key={newDate ?? editedActivity?.id}
                expensePeople={participants ?? []}
                expenseUserID={current?.user_id}
                showMoreDetails={
                  editedActivity ? !!editedActivity.showMoreDetails : true
                }
                initialValue={editedActivity ?? undefined}
                initialDate={newDate}
                initialStartsAt={
                  editing && "date" in editing ? editing.startsAt : undefined
                }
                initialPlace={editedActivity?.place ?? null}
                tripZone={trip.time_zone}
                tripID={trip.id}
                tripStart={trip.start_date}
                tripEnd={trip.end_date}
                tripStartsAt={trip.starts_at}
                tripEndsAt={trip.ends_at}
                pending={api.pending || !canEdit}
                error={api.error}
                onDirty={() => setEditDirty(true)}
                onCancel={closeEditor}
                onSubmit={async (input, requestKey) => {
                  if (!canEdit || api.pending) return;
                  try {
                    const saved = await api.save(
                      input,
                      editedActivity?.id,
                      requestKey,
                    );
                    if (saved) {
                      setEditDirty(false);
                      setEditing(null);
                      setSelected(localDate(input.starts_at, trip.time_zone));
                      if (saved !== true) setViewing(saved.id);
                    }
                  } catch {
                    /* The form retains its values and displays the API error. */
                  }
                }}
              />
            )}
          </TripDialog>
          {!unavailable &&
            (activities.isPending ? (
              <div role="status" className="timeline-loading space-y-3">
                <span className="sr-only">Loading activities…</span>
                <div />
                <div />
                <div />
              </div>
            ) : activities.isError ? (
              <TripError
                error={activities.error}
                retry={() => void activities.refetch()}
                pending={activities.isFetching}
              />
            ) : (
              <>
                <div aria-label="Trip dates" className="itinerary-board pb-3">
                  {[selected].map((date) => {
                    const dayActivities = selectedActivities;
                    return (
                      <section
                        key={date}
                        data-date={date}
                        aria-label={dateLabel(date)}
                        className="day-column"
                      >
                        <div
                          id={`day-${date}-details`}
                          role="region"
                          aria-labelledby={`day-${date}-heading`}
                          className="space-y-3"
                        >
                          {dayActivities.length === 0 ? (
                            <div className="day-empty">
                              <p className="font-semibold">
                                Nothing planned yet
                              </p>
                              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                {canEdit
                                  ? "Add your first activity to start planning this day."
                                  : "Activities will appear here when an editor adds them."}
                              </p>
                            </div>
                          ) : (
                            <ul className="space-y-4">
                              {dayActivities.map((activity) => {
                                return (
                                  <li
                                    key={activity.id}
                                    className="timeline-entry"
                                  >
                                    <p className="timeline-time">
                                      <time dateTime={activity.starts_at}>
                                        {timeLabel(
                                          activity.starts_at,
                                          trip.time_zone,
                                        )}
                                      </time>{" "}
                                      <span className="timeline-time-end">
                                        <span className="md:sr-only">– </span>
                                        <time dateTime={activity.ends_at}>
                                          {timeLabel(
                                            activity.ends_at,
                                            trip.time_zone,
                                          )}
                                        </time>
                                      </span>
                                      {localDate(
                                        activity.ends_at,
                                        trip.time_zone,
                                      ) > date && (
                                        <span className="timeline-end-date">
                                          {" "}
                                          · ends{" "}
                                          {dateLabel(
                                            localDate(
                                              activity.ends_at,
                                              trip.time_zone,
                                            ),
                                          )}
                                        </span>
                                      )}
                                    </p>
                                    <Card className="relative min-w-0 gap-0 ring-0">
                                      <CardContent className="px-3">
                                        <button
                                          type="button"
                                          className="absolute inset-0 cursor-pointer rounded-2xl outline-none transition-colors duration-150 hover:bg-muted/30 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                                          aria-label={`View details for ${activity.title}`}
                                          aria-haspopup="dialog"
                                          data-selected={
                                            viewing === activity.id || undefined
                                          }
                                          onClick={(event) => {
                                            detailTrigger.current =
                                              event.currentTarget;
                                            setViewing(activity.id);
                                          }}
                                        />
                                        <div className="activity-card-body pointer-events-none relative">
                                          <div className="activity-card-meta">
                                            <CategoryBadge
                                              category={activity.category}
                                            />
                                            <span className="activity-card-actions">
                                              <span className="activity-duration">
                                                {formatActivityDuration(
                                                  activity.starts_at,
                                                  activity.ends_at,
                                                )}
                                              </span>
                                              <ChevronRight
                                                aria-hidden="true"
                                                className="activity-open-cue"
                                              />
                                            </span>
                                          </div>
                                          <h4 className="break-words text-base leading-6 font-semibold">
                                            {activity.title}
                                          </h4>
                                          {activity.place && (
                                            <p className="flex items-start gap-2 text-sm text-muted-foreground">
                                              <MapPin
                                                aria-hidden="true"
                                                className="mt-0.5 size-4 shrink-0"
                                              />
                                              <span className="min-w-0 break-words">
                                                {activity.place.name}
                                              </span>
                                            </p>
                                          )}
                                        </div>
                                      </CardContent>
                                    </Card>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </>
            ))}
          {canEdit && !unavailable && activities.isSuccess && (
            <div className="mobile-add-activity fixed inset-x-0 z-30 border-t bg-background px-6 py-3 md:hidden">
              <Button
                className="min-h-12"
                disabled={api.pending || editing !== null}
                onClick={(event) => addActivity(selected, event.currentTarget)}
              >
                <Plus aria-hidden="true" />
                Add activity
              </Button>
            </div>
          )}
          <TripDialog
            title={
              expenseView === "overview"
                ? (viewedActivity?.title ?? "Activity details")
                : expenseView === "details" || expenseView === "personal"
                  ? "Expenses"
                  : "Borrow list"
            }
            focusTitleOnChange
            backLabel={
              expenseView === "overview"
                ? "Back to itinerary"
                : expenseView === "loans"
                  ? "Back to expenses"
                  : "Back to activity"
            }
            onBack={
              expenseView === "overview"
                ? undefined
                : () =>
                    navigateExpenses(
                      expenseView === "loans" ? "details" : "overview",
                    )
            }
            titleAccessory={
              viewedActivity &&
              expenseView === "overview" && (
                <span className="activity-detail-category">
                  {viewedActivity.category}
                </span>
              )
            }
            className="activity-details-dialog reference-activity-dialog"
            presentation="detail"
            mobilePresentation="fullscreen"
            headerAction={
              viewedActivity &&
              canEdit &&
              expenseView === "overview" && (
                <Button
                  variant="ghost"
                  disabled={api.pending || editing !== null}
                  aria-label={`Edit ${viewedActivity.title}`}
                  onClick={() => {
                    editTrigger.current = detailTrigger.current;
                    api.reset();
                    setEditDirty(false);
                    setEditing(viewedActivity);
                    setViewing(null);
                  }}
                >
                  Edit
                </Button>
              )
            }
            description={
              viewedActivity && expenseView === "overview" ? (
                <span className="activity-detail-schedule">
                  <span>
                    <span className="activity-detail-date">
                      {new Intl.DateTimeFormat(undefined, {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        timeZone: trip.time_zone,
                      }).formatRange(
                        new Date(viewedActivity.starts_at),
                        new Date(viewedActivity.ends_at),
                      )}
                    </span>
                    <span className="activity-detail-time">
                      {timeLabel(viewedActivity.starts_at, trip.time_zone)} –{" "}
                      {timeLabel(viewedActivity.ends_at, trip.time_zone)}
                      {" · "}
                      {trip.time_zone}
                    </span>
                  </span>
                </span>
              ) : (
                (viewedActivity?.title ?? "Activity details")
              )
            }
            open={!!viewedActivity}
            onOpenChange={(open) => {
              if (!open) {
                setViewing(null);
                if (params.has("activity"))
                  router.replace(`/trips/${trip.id}`, { scroll: false });
              }
            }}
            finalFocus={() =>
              editing || deleting ? false : returnFocus(detailTrigger.current)
            }
          >
            {viewedActivity && (
              <div
                ref={detailContent}
                className="activity-detail-sections text-sm leading-6"
              >
                <ActivityExpenses
                  key={viewedActivity.id}
                  trip={trip}
                  participants={participants}
                  current={current}
                  activityID={String(viewedActivity.id)}
                  activityTitle={viewedActivity.title}
                  onFailure={onFailure}
                  compact
                  view={expenseView}
                  onViewChange={navigateExpenses}
                />
                {expenseView === "overview" && (
                  <div className="activity-detail-notes">
                    {viewedActivity.place && (
                      <section className="space-y-1">
                        <h3 className="text-xs font-medium text-muted-foreground">
                          Place
                        </h3>
                        <p className="break-words font-medium">
                          {viewedActivity.place.name}
                        </p>
                        {viewedActivity.place.address && (
                          <p className="break-words text-muted-foreground">
                            {viewedActivity.place.address}
                          </p>
                        )}
                      </section>
                    )}
                    {viewedActivity.notes && (
                      <section className="space-y-1">
                        <h3>Notes</h3>
                        <p className="whitespace-pre-wrap break-words">
                          {viewedActivity.notes}
                        </p>
                      </section>
                    )}
                    {viewedActivity.checklist.length > 0 && (
                      <section className="space-y-1">
                        <h3>To do</h3>
                        <ul className="space-y-1">
                          {viewedActivity.checklist.map((item, index) => (
                            <li
                              key={index}
                              className="whitespace-pre-wrap break-words"
                            >
                              {item.text}
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
                  </div>
                )}
                {expenseView === "overview" && (
                  <details className="activity-management">
                    <summary>Activity options</summary>{" "}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="min-w-0 flex-1 break-words text-xs text-muted-foreground">
                        {participants
                          ? `Created by ${viewedCreator ? participantName(viewedCreator) : "Former participant"}`
                          : "Creator unavailable"}
                      </p>
                      {canEdit && (
                        <div className="flex shrink-0 justify-end gap-2">
                          <Button
                            variant="destructive"
                            disabled={api.pending || editing !== null}
                            aria-label={`Delete ${viewedActivity.title}`}
                            onClick={() => {
                              api.reset();
                              setDeleting(viewedActivity);
                              setViewing(null);
                            }}
                          >
                            <Trash2 aria-hidden="true" />
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                    {canEdit && (
                      <Button
                        variant="link"
                        onClick={() => {
                          editTrigger.current = detailTrigger.current;
                          api.reset();
                          setEditDirty(false);
                          setEditing({
                            ...viewedActivity,
                            showMoreDetails: true,
                          });
                          setViewing(null);
                        }}
                      >
                        Edit other activity details
                      </Button>
                    )}
                  </details>
                )}
              </div>
            )}
          </TripDialog>
          {deleting && canEdit && (
            <AlertDialog
              open
              onOpenChange={(open) => {
                if (!open && !api.pending) {
                  api.reset();
                  setDeleting(null);
                }
              }}
            >
              <AlertDialogContent
                className="w-[calc(100%-2rem)]"
                finalFocus={() => returnFocus(detailTrigger.current)}
              >
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete activity?</AlertDialogTitle>
                  <AlertDialogDescription className="break-words">
                    Permanently delete “{deleting.title}”? This cannot be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {api.error && <TripError error={api.error} />}
                <AlertDialogFooter>
                  <AlertDialogCancel
                    className="min-h-11"
                    disabled={api.pending}
                  >
                    Cancel
                  </AlertDialogCancel>
                  <Button
                    className="min-h-11"
                    variant="destructive"
                    disabled={api.pending}
                    onClick={async () => {
                      if (!canEdit || api.pending) return;
                      try {
                        if (await api.remove(deleting.id)) setDeleting(null);
                      } catch {
                        /* Keep the confirmation open and show the error. */
                      }
                    }}
                  >
                    {api.pending ? "Deleting…" : "Delete activity"}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </section>
    </div>
  );
}

function ConflictList({
  trip,
  conflicts,
  loaded,
  onUnavailable,
  onViewDay,
  onEdit,
}: {
  trip: Trip;
  conflicts: ActivityConflict[];
  loaded: Activity[];
  onUnavailable: () => Promise<void>;
  onViewDay: (date: string) => void;
  onEdit?: (activity: Activity) => void;
}) {
  const api = useItineraryApi(trip.id, () => {});
  const missingIDs = Array.from(
    new Set(conflicts.flatMap((conflict) => conflict.activity_ids)),
  ).filter((id) => !loaded.some((activity) => activity.id === id));
  const details = useQueries({
    queries: missingIDs.map((id) => ({
      queryKey: ["trip", trip.id, "activity", id],
      queryFn: ({ signal }: { signal: AbortSignal }) => api.get(id, signal),
      retry: false,
    })),
  });
  const missing = details.some(
    (query) => query.error instanceof ApiError && query.error.status === 404,
  );
  useEffect(() => {
    if (missing) void onUnavailable();
  }, [missing, onUnavailable]);
  function activityFor(id: number) {
    const known = loaded.find((activity) => activity.id === id);
    if (known) return known;
    const detail = details[missingIDs.indexOf(id)];
    return detail?.data;
  }
  function title(id: number) {
    const activity = activityFor(id);
    if (activity) return activity.title;
    const detail = details[missingIDs.indexOf(id)];
    return detail?.isError ? "Activity unavailable" : "Loading activity…";
  }
  const failure = details.find(
    (query) =>
      query.isError &&
      !(query.error instanceof ApiError && query.error.status === 404),
  );
  return (
    <>
      {missing && (
        <p role="status">
          An activity is unavailable. Refreshing the schedule…
        </p>
      )}
      {failure && (
        <TripError
          error={failure.error}
          retry={() => {
            details
              .filter((query) => query.isError)
              .forEach((query) => void query.refetch());
          }}
        />
      )}
      <ul className="space-y-4">
        {conflicts.map((conflict) => (
          <li
            key={conflict.activity_ids.join("-")}
            className="space-y-2 border-b pb-4 last:border-0 last:pb-0"
          >
            <p className="break-words font-medium">
              {title(conflict.activity_ids[0])} and{" "}
              {title(conflict.activity_ids[1])}
            </p>
            <p className="text-sm">
              <time dateTime={conflict.overlap_starts_at}>
                {formatActivityTime(conflict.overlap_starts_at, trip.time_zone)}
              </time>{" "}
              –{" "}
              <time dateTime={conflict.overlap_ends_at}>
                {formatActivityTime(conflict.overlap_ends_at, trip.time_zone)}
              </time>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() =>
                  onViewDay(
                    localDate(conflict.overlap_starts_at, trip.time_zone),
                  )
                }
              >
                View day
              </Button>
              {onEdit &&
                conflict.activity_ids.map((id) => (
                  <Button
                    key={id}
                    type="button"
                    variant="ghost"
                    className="min-h-11"
                    disabled={!activityFor(id)}
                    onClick={() => {
                      const activity = activityFor(id);
                      if (activity) onEdit(activity);
                    }}
                  >
                    Edit {title(id)}
                  </Button>
                ))}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
