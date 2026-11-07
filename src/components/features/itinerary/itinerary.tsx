"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ActivityExpenseView } from "@/components/features/expenses/activity-expenses";
import { useQuery } from "@tanstack/react-query";
import { Temporal } from "@js-temporal/polyfill";
import { Plus, Pencil } from "lucide-react";
import { ApiError } from "@/lib/api";
import { type Activity, useItineraryApi } from "@/lib/itinerary";
import {
  boundary,
  fullDateLabel,
  localDate,
  moveDate,
} from "@/lib/activity-time";
import type { Participant } from "@/lib/memberships";
import { type Trip } from "@/lib/trips";
import { Button } from "@/components/ui/button";
import { ActivityTimeline } from "@/components/features/itinerary/activity-timeline";
import { DayRail } from "@/components/features/itinerary/day-rail";
import { DayTools } from "@/components/features/itinerary/day-tools";
import { ActivityForm } from "@/components/features/itinerary/activity-form/activity-form";
import { DayConflictsDialog } from "@/components/features/itinerary/dialogs/day-conflicts-dialog";
import { DayMapDialog } from "@/components/features/itinerary/dialogs/day-map-dialog";
import { DayOptionsDialog } from "@/components/features/itinerary/dialogs/day-options-dialog";
import { DeleteActivityDialog } from "@/components/features/itinerary/dialogs/delete-activity-dialog";
import { ActivityDetailsDrawer } from "@/components/features/itinerary/drawers/activity-details-drawer";
import { AddActivityDrawer } from "@/components/features/itinerary/drawers/add-activity-drawer";
import { TripError } from "@/components/shared/trip-states";

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
    api.reset();
    if (editedActivity) setViewing(editedActivity.id);
    setEditing(null);
    if (editedActivity) focusSection();
    return true;
  };

  const dayTools = (
    <DayTools
      trip={trip}
      selected={selected}
      today={today}
      setSelected={setSelected}
      dayOptionsOpen={dayOptionsOpen}
      setDayOptionsOpen={setDayOptionsOpen}
      setMapOpen={setMapOpen}
      setConflictsOpen={setConflictsOpen}
      conflictsFailed={conflicts.isError}
      dayConflictCount={dayConflicts.length}
      dayToolTriggerRef={dayToolTrigger}
      dayOptionsTriggerRef={dayOptionsTrigger}
    />
  );
  const dayToolDialogs = (
    <>
      <DayMapDialog
        trip={trip}
        selected={selected}
        mapOpen={mapOpen}
        setMapOpen={setMapOpen}
        finalFocus={() => returnFocus(dayToolTrigger.current)}
        activitiesQuery={activities}
      />
      <DayConflictsDialog
        trip={trip}
        selected={selected}
        conflictsOpen={conflictsOpen}
        setConflictsOpen={setConflictsOpen}
        finalFocus={() =>
          editing ? false : returnFocus(dayToolTrigger.current)
        }
        conflictsQuery={conflicts}
        dayConflicts={dayConflicts}
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
                api.reset();
                setViewing(activity.id);
                setEditSection("details");
                setEditing(activity);
              }
            : undefined
        }
      />
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
        <DayRail
          trip={trip}
          dates={dates}
          selected={selected}
          today={today}
          setSelected={setSelected}
          activitiesQuery={activities}
          dayRail={dayRail}
        />
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
              <DayOptionsDialog
                selected={selected}
                dayOptionsOpen={dayOptionsOpen}
                setDayOptionsOpen={setDayOptionsOpen}
                mapOpen={mapOpen}
                conflictsOpen={conflictsOpen}
                dayOptionsTrigger={dayOptionsTrigger}
                dayTools={dayTools}
              />
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
          <AddActivityDrawer
            open={!!editing && !editedActivity && canEdit}
            date={newDate ?? selected}
            busy={api.pending}
            titleInput={titleInput}
            finalFocus={() => returnFocus(editTrigger.current)}
            closeEditor={closeEditor}
          >
            {!editedActivity && activityForm}
          </AddActivityDrawer>
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
                <ActivityTimeline
                  trip={trip}
                  selected={selected}
                  selectedActivities={selectedActivities}
                  canEdit={canEdit}
                  viewing={viewing}
                  setViewing={setViewing}
                  detailTriggerRef={detailTrigger}
                />
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
          <ActivityDetailsDrawer
            trip={trip}
            participants={participants}
            current={current}
            canEdit={canEdit}
            onFailure={onFailure}
            api={api}
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
            expenseView={expenseView}
            navigateExpenses={navigateExpenses}
            detailActivity={detailActivity}
            editedActivity={editedActivity}
            editSection={editSection}
            activityForm={activityForm}
            sectionEditButton={sectionEditButton}
            sectionAddButton={sectionAddButton}
            detailContent={detailContent}
            viewedCreator={viewedCreator}
            isEditing={editing !== null}
            setDeleting={setDeleting}
            setViewing={setViewing}
          />
          {deleting && canEdit && (
            <DeleteActivityDialog
              deleting={deleting}
              setDeleting={setDeleting}
              canEdit={canEdit}
              api={api}
              finalFocus={() => returnFocus(detailTrigger.current)}
            />
          )}
        </div>
      </section>
    </div>
  );
}
