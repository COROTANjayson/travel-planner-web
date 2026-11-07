"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ActivityExpenses,
  type ActivityExpenseView,
} from "@/components/features/expenses/expenses";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Temporal } from "@js-temporal/polyfill";
import {
  MapPin,
  CalendarCheck,
  CalendarDays,
  SlidersHorizontal,
  ChevronRight,
  Plus,
  Tag,
  Trash2,
  Pencil,
} from "lucide-react";
import { TripDialog } from "@/components/shared/trip-dialog";
import { ApiError } from "@/lib/api";
import {
  activityCategoryIcons,
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
import { ActivityForm } from "@/components/features/itinerary/activity-form/activity-form";
import { TripError } from "@/components/shared/trip-states";

const TripMap = dynamic(
  () => import("@/components/features/itinerary/trip-map"),
  {
    ssr: false,
    loading: () => <p role="status">Loading map…</p>,
  },
);

function CategoryBadge({ category }: { category: string }) {
  const Icon = Object.hasOwn(activityCategoryIcons, category)
    ? activityCategoryIcons[category]
    : Tag;
  return (
    <span className="activity-category" data-category={category}>
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="min-w-0 break-words">{category}</span>
    </span>
  );
}

const fullDateLabel = (date: string) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
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
  const [conflictsOpen, setConflictsOpen] = useState(false);
  const [editing, setEditing] = useState<
    Activity | { date: string; startsAt?: string } | null
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
  const [editSection, setEditSection] = useState<
    "details" | "place" | "notes" | "checklist"
  >("details");
  if (expenseActivity !== viewing) {
    setExpenseActivity(viewing);
    setExpenseView("overview");
  }
  function navigateExpenses(next: ActivityExpenseView) {
    if (editedActivity && !closeEditor()) return;
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
  const detailActivity = viewedActivity ?? editedActivity;
  const focusSection = () =>
    requestAnimationFrame(() =>
      detailContent.current
        ?.closest("[role=dialog]")
        ?.querySelector<HTMLElement>(`[data-edit-section="${editSection}"]`)
        ?.focus(),
    );
  const newDate = editing && "date" in editing ? editing.date : undefined;
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
    if (api.pending) return false;
    if (editDirty && !window.confirm("Discard your unsaved activity changes?"))
      return false;
    api.reset();
    setEditDirty(false);
    if (editedActivity) setViewing(editedActivity.id);
    setEditing(null);
    if (editedActivity) focusSection();
    return true;
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
      {(conflicts.isError || dayConflicts.length > 0) && (
        <Button
          variant="ghost"
          className="day-tool-overlaps min-h-11 px-2"
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
          <span className="rounded-full px-2 py-0.5 text-xs">
            {conflicts.isError ? "Unavailable" : dayConflicts.length}
          </span>
        </Button>
      )}
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
                          api.reset();
                          setViewing(activity.id);
                          setEditSection("details");
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

  const activityForm = editing && (
    <ActivityForm
      titleRef={titleInput}
      section={editedActivity ? editSection : undefined}
      key={newDate ?? editedActivity?.id}
      expensePeople={participants ?? []}
      expenseUserID={current?.user_id}
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
          const changes =
            editSection === "details"
              ? {
                  title: input.title,
                  category: input.category,
                  starts_at: input.starts_at,
                  ends_at: input.ends_at,
                }
              : editSection === "place"
                ? { place_id: input.place_id }
                : editSection === "notes"
                  ? { notes: input.notes }
                  : { checklist: input.checklist };
          const payload = editedActivity
            ? {
                ...(detailActivity ?? editedActivity),
                time_zone: trip.time_zone,
                ...changes,
              }
            : input;
          const saved = await api.save(payload, editedActivity?.id, requestKey);
          if (saved) {
            setEditDirty(false);
            setEditing(null);
            setSelected(localDate(payload.starts_at, trip.time_zone));
            if (saved !== true) setViewing(saved.id);
            else if (editedActivity) setViewing(editedActivity.id);
            if (editedActivity) focusSection();
          }
        } catch {
          /* The form retains its values and displays the API error. */
        }
      }}
    />
  );

  const startSectionEdit = (section: typeof editSection) => {
    if (!canEdit || api.pending || editing || !detailActivity) return;
    api.reset();
    setEditDirty(false);
    setEditSection(section);
    setEditing(detailActivity);
  };
  const sectionEditButton = (section: typeof editSection, label: string) =>
    canEdit && (
      <Button
        type="button"
        variant="ghost"
        className="activity-section-edit size-11 min-h-11 shrink-0 text-muted-foreground hover:text-primary focus-visible:text-primary"
        aria-label={label}
        data-edit-section={section}
        disabled={api.pending || editing !== null}
        onClick={() => startSectionEdit(section)}
      >
        <Pencil aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
      </Button>
    );
  const sectionAddButton = (section: typeof editSection, label: string) =>
    canEdit && (
      <Button
        type="button"
        variant="link"
        className="min-h-11 px-0"
        data-edit-section={section}
        disabled={api.pending || editing !== null}
        onClick={() => startSectionEdit(section)}
      >
        <Plus aria-hidden="true" className="size-3.5" />
        {label}
      </Button>
    );

  return (
    <div className="coastal-itinerary flex min-w-0 flex-col gap-6">
      <section
        aria-labelledby="itinerary-heading"
        className="itinerary-workspace"
      >
        <nav className="itinerary-days" aria-label="Choose itinerary day">
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
                <time dateTime={selected}>{fullDateLabel(selected)}</time>
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
            <div className="itinerary-day-summary">
              <div className="hidden md:block">{dayTools}</div>
            </div>
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
          {dayToolDialogs}
          {api.error && !editing && !deleting && (
            <TripError error={api.error} />
          )}
          <TripDialog
            open={!!editing && !editedActivity && canEdit}
            presentation="detail"
            className="activity-details-dialog reference-activity-dialog activity-planning-dialog"
            backLabel="Back to itinerary"
            title="Add activity"
            headerContent={<h2>{fullDateLabel(newDate ?? selected)}</h2>}
            busy={api.pending}
            disablePointerDismissal
            initialFocus={titleInput}
            finalFocus={() => returnFocus(editTrigger.current)}
            onOpenChange={(open) => {
              if (!open) closeEditor();
            }}
          >
            {!editedActivity && activityForm}
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
                                          className="absolute inset-0 cursor-pointer rounded-2xl outline-none transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
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
                                          <h4 className="break-words text-lg leading-7 font-semibold md:text-xl">
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
                ? (detailActivity?.title ?? "Activity details")
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
              detailActivity &&
              expenseView === "overview" && (
                <CategoryBadge category={detailActivity.category} />
              )
            }
            className="activity-details-dialog reference-activity-dialog"
            busy={api.pending}
            disablePointerDismissal={!!editedActivity}
            presentation="detail"
            mobilePresentation="fullscreen"
            headerContent={
              editedActivity && editSection === "details"
                ? activityForm
                : undefined
            }
            titleAction={
              expenseView === "overview" &&
              editSection === "details" &&
              editedActivity
                ? undefined
                : expenseView === "overview" &&
                  sectionEditButton("details", "Edit activity details")
            }
            description={
              detailActivity && expenseView === "overview" ? (
                <span className="activity-detail-schedule">
                  <span>
                    <span className="activity-detail-date">
                      {new Intl.DateTimeFormat(undefined, {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        timeZone: trip.time_zone,
                      }).formatRange(
                        new Date(detailActivity.starts_at),
                        new Date(detailActivity.ends_at),
                      )}
                    </span>
                    <span className="activity-detail-time">
                      {timeLabel(detailActivity.starts_at, trip.time_zone)} –{" "}
                      {timeLabel(detailActivity.ends_at, trip.time_zone)}
                      {" · "}
                      {trip.time_zone}
                    </span>
                  </span>
                </span>
              ) : (
                (detailActivity?.title ?? "Activity details")
              )
            }
            open={!!detailActivity || !!editedActivity}
            onOpenChange={(open) => {
              if (!open) {
                if (editing && !closeEditor()) return;
                setViewing(null);
                if (params.has("activity"))
                  router.replace(`/trips/${trip.id}`, { scroll: false });
              }
            }}
            finalFocus={() =>
              editing || deleting ? false : returnFocus(detailTrigger.current)
            }
            footer={
              detailActivity &&
              expenseView === "overview" && (
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 flex-1 break-words text-xs text-muted-foreground">
                    {participants
                      ? `Created by ${viewedCreator ? participantName(viewedCreator) : "Former participant"}`
                      : "Creator unavailable"}
                  </p>
                  {canEdit && (
                    <Button
                      className="activity-delete shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      variant="ghost"
                      disabled={api.pending || editing !== null}
                      aria-label={`Delete ${detailActivity.title}`}
                      onClick={() => {
                        api.reset();
                        setDeleting(detailActivity);
                        setViewing(null);
                      }}
                    >
                      <Trash2 aria-hidden="true" />
                      Delete
                    </Button>
                  )}
                </div>
              )
            }
          >
            {detailActivity && (
              <div
                ref={detailContent}
                className="activity-detail-sections text-sm leading-6"
              >
                {editedActivity && !canEdit && (
                  <p role="alert" className="text-sm text-destructive">
                    Your edit permission has changed. Cancel to return to
                    reading.
                  </p>
                )}
                <ActivityExpenses
                  key={detailActivity.id}
                  trip={trip}
                  participants={participants}
                  current={current}
                  activityID={String(detailActivity.id)}
                  activityTitle={detailActivity.title}
                  onFailure={onFailure}
                  compact
                  view={expenseView}
                  onViewChange={navigateExpenses}
                />
                {expenseView === "overview" && (
                  <div className="activity-detail-notes">
                    {(detailActivity.place ||
                      canEdit ||
                      (editedActivity && editSection === "place")) && (
                      <section className="space-y-1">
                        {editedActivity && editSection === "place" ? (
                          activityForm
                        ) : (
                          <>
                            <div className="activity-section-heading">
                              <h3>Place</h3>
                              {detailActivity.place &&
                                sectionEditButton("place", "Edit place")}
                            </div>
                            {detailActivity.place ? (
                              <>
                                <p className="break-words font-medium">
                                  {detailActivity.place.name}
                                </p>
                                {detailActivity.place.address && (
                                  <p className="break-words text-muted-foreground">
                                    {detailActivity.place.address}
                                  </p>
                                )}
                              </>
                            ) : (
                              sectionAddButton("place", "Add place")
                            )}
                          </>
                        )}
                      </section>
                    )}
                    {(detailActivity.notes ||
                      canEdit ||
                      (editedActivity && editSection === "notes")) && (
                      <section className="space-y-1">
                        {editedActivity && editSection === "notes" ? (
                          activityForm
                        ) : (
                          <>
                            <div className="activity-section-heading">
                              <h3>Notes</h3>
                              {detailActivity.notes &&
                                sectionEditButton("notes", "Edit notes")}
                            </div>
                            {detailActivity.notes ? (
                              <p className="whitespace-pre-wrap break-words">
                                {detailActivity.notes}
                              </p>
                            ) : (
                              sectionAddButton("notes", "Add notes")
                            )}
                          </>
                        )}
                      </section>
                    )}
                    {(detailActivity.checklist.length > 0 ||
                      canEdit ||
                      (editedActivity && editSection === "checklist")) && (
                      <section className="space-y-1">
                        {editedActivity && editSection === "checklist" ? (
                          activityForm
                        ) : (
                          <>
                            <div className="activity-section-heading">
                              <h3>To do</h3>
                              {detailActivity.checklist.length > 0 &&
                                sectionEditButton("checklist", "Edit to do")}
                            </div>
                            {detailActivity.checklist.length > 0 ? (
                              <ul className="space-y-1">
                                {detailActivity.checklist.map((item, index) => (
                                  <li
                                    key={index}
                                    className="whitespace-pre-wrap break-words"
                                  >
                                    {item.text}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              sectionAddButton("checklist", "Add to-do")
                            )}
                          </>
                        )}
                      </section>
                    )}
                  </div>
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
