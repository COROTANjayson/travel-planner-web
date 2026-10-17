"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Temporal } from "@js-temporal/polyfill";
import { TZDate } from "react-day-picker";
import { MapPin, CalendarCheck, CalendarDays, MoreHorizontal, Plus } from "lucide-react";
import { TripDialog } from "./trip-dialog";
import { ApiError } from "@/lib/api";
import { activityPageSize, type Activity, type ActivityConflict, useItineraryApi } from "@/lib/itinerary";
import { formatActivityTime } from "@/lib/activity-time";
import { participantName, type Participant } from "@/lib/memberships";
import { type Trip } from "@/lib/trips";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ActivityForm } from "./activity-form";
import { TripError } from "./trip-states";

const TripMap = dynamic(() => import("./trip-map"), { ssr: false, loading: () => <p role="status">Loading map…</p> });

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const dateLabel = (date: string) => new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
const timeLabel = (instant: string, zone: string) => new Intl.DateTimeFormat(undefined, { timeZone: zone, timeStyle: "short" }).format(new Date(instant));
const localDate = (instant: string, zone: string) => Temporal.Instant.from(instant).toZonedDateTimeISO(zone).toPlainDate().toString();
const boundary = (date: string, zone: string) => Temporal.PlainDate.from(date).toZonedDateTime({ timeZone: zone, plainTime: "00:00" }).toInstant().toString();
const moveDate = (date: string, days: number) => Temporal.PlainDate.from(date).add({ days }).toString();

function visibleDates(start: string, end: string, selected: string) {
  const offset = Temporal.PlainDate.from(selected).since(Temporal.PlainDate.from(start)).days;
  const anchor = moveDate(start, Math.floor(offset / 3) * 3);
  return Array.from({ length: 3 }, (_, index) => moveDate(anchor, index)).filter((date) => date <= end);
}

export function Itinerary({ trip, participants, canEdit, onFailure, header, tools }: {
  header: ReactNode; tools: ReactNode;
  trip: Trip; participants?: Participant[]; canEdit: boolean; onFailure: (error: Error) => void | Promise<void>;
}) {
  const api = useItineraryApi(trip.id, onFailure);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = Temporal.Now.zonedDateTimeISO(trip.time_zone).toPlainDate().toString();
    return today >= trip.start_date && today <= trip.end_date ? today : trip.start_date;
  });
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [conflictsOpen, setConflictsOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | { date: string; startsAt?: string } | null>(null);
  const [editDirty, setEditDirty] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const titleInput = useRef<HTMLInputElement>(null);
  const editTrigger = useRef<HTMLButtonElement | null>(null);
  const selectedHeading = useRef<HTMLHeadingElement>(null);
  const [deleting, setDeleting] = useState<Activity | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [actions, setActions] = useState<Activity | null>(null);
  const actionTrigger = useRef<HTMLButtonElement | null>(null);
  function setSelected(date: string) {
    setSelectedDate(date);
  }
  const selected = selectedDate < trip.start_date ? trip.start_date : selectedDate > trip.end_date ? trip.end_date : selectedDate;
  const dates = visibleDates(trip.start_date, trip.end_date, selected);
  const from = boundary(dates[0], trip.time_zone);
  const before = boundary(moveDate(dates[dates.length - 1], 1), trip.time_zone);
  const activities = useQuery({ queryKey: ["trip", trip.id, "activities", "board", from, before], queryFn: ({ signal }) => api.listRange(from, before, signal), retry: false });
  const conflicts = useQuery({ queryKey: ["trip", trip.id, "conflicts", "all"], queryFn: async ({ signal }) => {
    // ponytail: read every conflict page before filtering by day; add API date filtering if large trips make this slow.
    const all: ActivityConflict[] = [];
    for (let offset = 0;; offset += activityPageSize) {
      const page = await api.conflicts(offset, signal);
      all.push(...page);
      if (page.length < activityPageSize) return all;
    }
  }, retry: false });
  const dayStart = boundary(selected, trip.time_zone);
  const dayEnd = boundary(moveDate(selected, 1), trip.time_zone);
  const dayConflicts = conflicts.data?.filter((conflict) => Temporal.Instant.compare(conflict.overlap_starts_at, dayEnd) < 0 && Temporal.Instant.compare(conflict.overlap_ends_at, dayStart) > 0) ?? [];
  useEffect(() => {
    const failure = [activities.error, conflicts.error].find((error) => error instanceof ApiError && error.status === 404);
    if (failure) void onFailure(failure);
  }, [activities.error, conflicts.error, onFailure]);
  const unavailable = [activities.error, conflicts.error].some((error) => error instanceof ApiError && error.status === 404);
  const editedActivity = editing && "id" in editing ? editing : null;
  const newDate = editing && "date" in editing ? editing.date : undefined;
  const [year, month, day] = selected.split("-").map(Number);
  const today = Temporal.Now.zonedDateTimeISO(trip.time_zone).toPlainDate().toString();
  const dayNumber = Temporal.PlainDate.from(selected).since(Temporal.PlainDate.from(trip.start_date)).days + 1;
  const dayCount = Temporal.PlainDate.from(trip.end_date).since(Temporal.PlainDate.from(trip.start_date)).days + 1;
  useEffect(() => {
    const board = boardRef.current;
    if (!board || window.matchMedia("(min-width: 1024px)").matches) return;
    const column = board.querySelector<HTMLElement>(`[data-date="${selected}"]`);
    if (column) board.scrollTo({ left: column.offsetLeft, behavior: "instant" });
  }, [selected, activities.data]);
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    let timer: ReturnType<typeof setTimeout>;
    const settle = () => {
      if (!window.matchMedia("(max-width: 767px)").matches) return;
      const columns = Array.from(board.querySelectorAll<HTMLElement>("[data-date]"));
      const nearest = columns.reduce<HTMLElement | undefined>((best, column) =>
        !best || Math.abs(column.getBoundingClientRect().left - board.getBoundingClientRect().left) < Math.abs(best.getBoundingClientRect().left - board.getBoundingClientRect().left) ? column : best, undefined);
      if (nearest?.dataset.date) setSelectedDate(nearest.dataset.date);
    };
    const onScroll = () => { clearTimeout(timer); timer = setTimeout(settle, 150); };
    board.addEventListener("scroll", onScroll, { passive: true });
    return () => { clearTimeout(timer); board.removeEventListener("scroll", onScroll); };
  }, [activities.data]);
  function addActivity(date: string, trigger: HTMLButtonElement) {
    const dayActivities = activities.data?.filter((activity) => localDate(activity.starts_at, trip.time_zone) === date) ?? [];
    const latestEnd = dayActivities.reduce<string | undefined>((latest, activity) => !latest || Temporal.Instant.compare(activity.ends_at, latest) > 0 ? activity.ends_at : latest, undefined);
    editTrigger.current = trigger; api.reset(); setEditDirty(false); setSaveMessage("");
    setEditing({ date, startsAt: latestEnd && localDate(latestEnd, trip.time_zone) === date ? latestEnd : undefined });
  }
  const closeEditor = () => {
    if (api.pending) return;
    if (editDirty && !window.confirm("Discard your unsaved activity changes?")) return;
    api.reset(); setEditDirty(false); setEditing(null);
  };

  const dayTools = <nav aria-label={`Tools for ${dateLabel(selected)}`} className="flex flex-wrap gap-2">
        <TripDialog title={`Places on ${dateLabel(selected)}`} description="Places attached to activities on the selected day."
          trigger={<Button variant="outline" className="min-h-11"><MapPin aria-hidden="true" />Map</Button>}>
          {activities.isPending ? <p role="status">Loading places...</p> : activities.isError ? <TripError error={activities.error} retry={() => void activities.refetch()} /> : <TripMap activities={activities.data.filter((activity) => localDate(activity.starts_at, trip.time_zone) === selected)} />}
        </TripDialog>
        <TripDialog title={`Conflicts on ${dateLabel(selected)}`} description="Overlapping activities on this day." open={conflictsOpen} onOpenChange={setConflictsOpen}
          trigger={<Button variant="outline" className="min-h-11"><CalendarCheck aria-hidden="true" />Conflicts{(conflicts.isError || dayConflicts.length > 0) && <span className="size-2 rounded-full bg-amber-500" aria-label={conflicts.isError ? "Check unavailable" : "Overlaps found"} />}</Button>}>
          <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Overlaps are advisory. Parallel activities are allowed. Overlap times below use {trip.time_zone}.</p>
              {conflicts.isPending ? <p role="status">Loading conflicts…</p> : conflicts.isError ?
                <TripError error={conflicts.error} retry={() => void conflicts.refetch()} pending={conflicts.isFetching} /> : <>
                  {dayConflicts.length === 0 ? <p className="text-muted-foreground">No schedule conflicts on this day.</p> :
                    <ConflictList trip={trip} conflicts={dayConflicts} loaded={activities.data ?? []} onUnavailable={api.refresh}
                      onViewDay={(date) => { setSelected(date); setConflictsOpen(false); }}
                      onEdit={canEdit ? (activity) => { setConflictsOpen(false); setEditDirty(false); setEditing(activity); } : undefined} />}
                </>}
          </div>
        </TripDialog>
  </nav>;

  return <>
    <header className="planning-header flex flex-col gap-6">
      <div className="min-w-0 w-full">{header}</div>
      <nav aria-label="Trip tools" className="hidden shrink-0 flex-wrap gap-2 md:flex">
        {tools}
      </nav>
    </header>
    <div className="planning-workspace"><section aria-labelledby="itinerary-heading" className="min-w-0 space-y-3">
    <div className="itinerary-toolbar sticky z-30 -mx-4 space-y-2 border-b bg-background/95 px-4 py-2 backdrop-blur md:static md:mx-0 md:border-0 md:px-0">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="itinerary-heading" className="sr-only text-xl font-semibold md:not-sr-only">Itinerary</h2>
      <div className="flex w-full min-w-0 items-center gap-2 md:w-auto">

        <Button type="button" variant="outline" className="size-12 shrink-0 md:size-11" disabled={selected <= trip.start_date} onClick={() => setSelected(moveDate(selected, -1))} aria-label="Previous date">←</Button>
        <TripDialog title="Choose a day" description={`Day ${dayNumber} of ${dayCount}`} mobilePresentation="sheet" open={datePickerOpen} onOpenChange={setDatePickerOpen}
          trigger={<Button type="button" variant="outline" className="min-h-12 min-w-0 flex-1 whitespace-normal px-2 text-sm md:min-h-11 md:flex-none md:px-3" aria-label="Jump to date"><CalendarDays aria-hidden="true" className="hidden size-4 min-[375px]:block" />{dateLabel(selected)}</Button>}>
          <div className="flex justify-center">
            <Calendar mode="single" timeZone={trip.time_zone} selected={new TZDate(year, month - 1, day, trip.time_zone)}
              defaultMonth={new TZDate(year, month - 1, day, trip.time_zone)} captionLayout="dropdown"
              startMonth={new TZDate(Number(trip.start_date.slice(0, 4)), Number(trip.start_date.slice(5, 7)) - 1, 1, trip.time_zone)}
              endMonth={new TZDate(Number(trip.end_date.slice(0, 4)), Number(trip.end_date.slice(5, 7)) - 1, 1, trip.time_zone)}
              disabled={(date) => dateKey(date) < trip.start_date || dateKey(date) > trip.end_date}
              onSelect={(date) => { if (date) { setSelected(dateKey(date)); setDatePickerOpen(false); } }} />
          </div>
        </TripDialog>
        <Button type="button" variant="outline" className="size-12 shrink-0 md:size-11" disabled={selected >= trip.end_date} onClick={() => setSelected(moveDate(selected, 1))} aria-label="Next date">→</Button>
      </div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2"><p role="status" aria-live="polite" className="text-sm text-muted-foreground">Day {dayNumber} of {dayCount}</p>
        {today >= trip.start_date && today <= trip.end_date && selected !== today && <Button type="button" variant="ghost" onClick={() => setSelected(today)}>Today</Button>}
      </div>
      {dayTools}
    </div>
    </div>
    <nav aria-label="Choose itinerary day" className="flex gap-2 overflow-x-auto pb-2">{dates.map((date) => <Button key={date} variant={date === selected ? "default" : "outline"} className="min-h-12 shrink-0" aria-pressed={date === selected} onClick={() => setSelected(date)}>{dateLabel(date)}</Button>)}</nav>
    <p className="break-words text-sm text-muted-foreground">All times in {trip.time_zone}.</p>
    <p role="status" aria-live="polite" className="sr-only">{saveMessage}</p>
    {api.error && !editing && !deleting && <TripError error={api.error} />}
    <TripDialog open={!!editing && canEdit} title={editedActivity ? "Edit activity" : "Add activity"}
      description={`${newDate ? `${dateLabel(newDate)} · ` : ""}Times in ${trip.time_zone}.`} busy={api.pending} disablePointerDismissal
      initialFocus={titleInput} finalFocus={() => editTrigger.current?.isConnected && !editTrigger.current.disabled && editTrigger.current.getClientRects().length ? editTrigger.current : selectedHeading.current}
      onOpenChange={(open) => { if (!open) closeEditor(); }}>
      {editing && <ActivityForm titleRef={titleInput} key={newDate ?? editedActivity?.id} initialValue={editedActivity ?? undefined} initialDate={newDate} initialStartsAt={editing && "date" in editing ? editing.startsAt : undefined}
        initialPlace={editedActivity?.place ?? null} tripZone={trip.time_zone} tripID={trip.id}
        tripStart={trip.start_date} tripEnd={trip.end_date} tripStartsAt={trip.starts_at} tripEndsAt={trip.ends_at}
        pending={api.pending || !canEdit} error={api.error} onDirty={() => setEditDirty(true)} onCancel={closeEditor}
        onSubmit={async (input) => {
          if (!canEdit || api.pending) return;
          try { if (await api.save(input, editedActivity?.id)) { setEditDirty(false); setEditing(null); setSelected(localDate(input.starts_at, trip.time_zone)); setSaveMessage(editedActivity ? "Activity updated." : "Activity added."); } }
          catch { /* The form retains its values and displays the API error. */ }
        }} />}
    </TripDialog>
    {!unavailable && (activities.isPending ? <p role="status">Loading activities…</p> : activities.isError ?
      <TripError error={activities.error} retry={() => void activities.refetch()} pending={activities.isFetching} /> : <>
        <div ref={boardRef} aria-label="Trip dates" tabIndex={0} data-count={dates.length} className="itinerary-board relative flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto overscroll-x-contain pb-3 focus-visible:outline-2 focus-visible:outline-ring">
          {dates.filter((date) => date === selected).map((date) => {
            const dayActivities = activities.data.filter((activity) => localDate(activity.starts_at, trip.time_zone) === date).sort((a, b) => Temporal.Instant.compare(a.starts_at, b.starts_at));
            return <section key={date} data-date={date} aria-label={dateLabel(date)} className={`${date === selected ? "border-primary/60 bg-secondary/30" : "bg-muted/40"} day-column min-h-64 min-w-0 shrink-0 snap-start rounded-2xl border p-2`}>
              <h3 ref={date === selected ? selectedHeading : undefined} tabIndex={-1} className="outline-none">
                <button type="button" id={`day-${date}-heading`} aria-pressed={date === selected} aria-controls={`day-${date}-details`}
                  className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg p-2 text-left focus-visible:outline-2 focus-visible:outline-ring"
                  onClick={() => setSelected(date)}>
                  <span className="font-semibold"><time dateTime={date}>{dateLabel(date)}</time></span>
                  <span className="flex items-center gap-3 text-sm text-muted-foreground">{dayActivities.length} {dayActivities.length === 1 ? "activity" : "activities"}</span>
                </button>
              </h3>
              <div id={`day-${date}-details`} role="region" aria-labelledby={`day-${date}-heading`} className="space-y-3 pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {canEdit && <Button type="button" variant="outline" className="journey-accent hidden min-h-12 md:inline-flex" disabled={api.pending || editing !== null}
                  onClick={(event) => addActivity(date, event.currentTarget)}>+ Add activity</Button>}
              </div>
              {dayActivities.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Nothing planned yet. {canEdit ? "Add an activity to start this day." : "Activities will appear here when an editor adds them."}</p> :
                <ul className="space-y-3">{dayActivities.map((activity) => {
                  const creator = participants?.find((person) => person.user_id === activity.created_by_user_id);
                  return <li key={activity.id} className="timeline-entry"><p className="timeline-time"><time dateTime={activity.starts_at}>{timeLabel(activity.starts_at, trip.time_zone)}</time></p><Card className="gap-3"><CardContent className="relative space-y-2 px-3">
                    <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 py-2 text-sm font-semibold text-primary"><time dateTime={activity.starts_at}>{timeLabel(activity.starts_at, trip.time_zone)}</time> – <time dateTime={activity.ends_at}>{timeLabel(activity.ends_at, trip.time_zone)}</time>{localDate(activity.ends_at, trip.time_zone) > date && <span className="text-muted-foreground"> · ends next day</span>}</p>
                    {canEdit && <Button className="size-12 shrink-0 md:size-11" variant="ghost" disabled={api.pending || editing !== null} aria-label={`Actions for ${activity.title}`}
                      onClick={(event) => { actionTrigger.current = event.currentTarget; setActions(activity); }}><MoreHorizontal aria-hidden="true" /><span className="sr-only">Activity options</span></Button>}
                    </div>
                    <h4 className="break-words text-lg leading-[1.625rem] font-semibold">{activity.title}</h4>
                    {activity.place && <p className="flex items-start gap-2 text-sm text-muted-foreground"><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span className="min-w-0 break-words">{activity.place.name}</span></p>}
                    {activity.notes && <details className="text-sm"><summary className="min-h-11 cursor-pointer py-3 text-muted-foreground">Notes</summary><p className="mt-2 whitespace-pre-wrap break-words">{activity.notes}</p></details>}
                    <p className="text-xs text-muted-foreground">{participants ? `Created by ${creator ? participantName(creator) : "Former participant"}` : "Creator unavailable"}</p>

                  </CardContent></Card></li>;
                })}</ul>}
              </div>
            </section>;
          })}
        </div>
      </>)}
    {canEdit && !unavailable && activities.isSuccess && <div className="mobile-add-activity fixed inset-x-0 z-30 border-t bg-background/95 px-4 py-3 backdrop-blur md:hidden">
      <Button className="journey-accent min-h-12 w-full" disabled={api.pending || editing !== null} onClick={(event) => addActivity(selected, event.currentTarget)}><Plus aria-hidden="true" />Add activity</Button>
    </div>}
    <TripDialog title="Activity options" description={actions?.title ?? "Choose an action"} mobilePresentation="sheet" open={!!actions && canEdit} onOpenChange={(open) => { if (!open) setActions(null); }} finalFocus={() => editing || deleting ? false : actionTrigger.current}>
      {actions && <div className="space-y-2">
        <Button className="w-full justify-start" variant="ghost" disabled={api.pending || editing !== null} aria-label={`Edit ${actions.title}`} onClick={() => { editTrigger.current = actionTrigger.current; api.reset(); setEditDirty(false); setSaveMessage(""); setEditing(actions); setActions(null); }}>Edit</Button>
        <Button className="w-full justify-start text-destructive" variant="ghost" disabled={api.pending || editing !== null} aria-label={`Delete ${actions.title}`} onClick={() => { api.reset(); setDeleting(actions); setActions(null); }}>Delete</Button>
      </div>}
    </TripDialog>
    {deleting && canEdit && <AlertDialog open onOpenChange={(open) => { if (!open && !api.pending) { api.reset(); setDeleting(null); } }}>
      <AlertDialogContent className="w-[calc(100%-2rem)]">
        <AlertDialogHeader><AlertDialogTitle>Delete activity?</AlertDialogTitle><AlertDialogDescription className="break-words">Permanently delete “{deleting.title}”? This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
        {api.error && <TripError error={api.error} />}
        <AlertDialogFooter><AlertDialogCancel className="min-h-11" disabled={api.pending}>Cancel</AlertDialogCancel>
          <Button className="min-h-11" variant="destructive" disabled={api.pending} onClick={async () => {
            if (!canEdit || api.pending) return;
            try { if (await api.remove(deleting.id)) setDeleting(null); }
            catch { /* Keep the confirmation open and show the error. */ }
          }}>{api.pending ? "Deleting…" : "Delete activity"}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>}
  </section><aside className="planning-map" aria-label="Selected day map"><h2 className="mb-4 text-xl font-bold">Your day, on the map</h2>{activities.isPending ? <p role="status">Loading places...</p> : activities.isError ? <TripError error={activities.error} retry={() => void activities.refetch()} /> : <TripMap activities={activities.data.filter((activity) => localDate(activity.starts_at, trip.time_zone) === selected)} />}</aside></div></>;
}

function ConflictList({ trip, conflicts, loaded, onUnavailable, onViewDay, onEdit }: {
  trip: Trip; conflicts: ActivityConflict[]; loaded: Activity[]; onUnavailable: () => Promise<void>;
  onViewDay: (date: string) => void; onEdit?: (activity: Activity) => void;
}) {
  const api = useItineraryApi(trip.id, () => {});
  const missingIDs = Array.from(new Set(conflicts.flatMap((conflict) => conflict.activity_ids))).filter((id) => !loaded.some((activity) => activity.id === id));
  const details = useQueries({ queries: missingIDs.map((id) => ({
    queryKey: ["trip", trip.id, "activity", id], queryFn: ({ signal }: { signal: AbortSignal }) => api.get(id, signal), retry: false,
  })) });
  const missing = details.some((query) => query.error instanceof ApiError && query.error.status === 404);
  useEffect(() => { if (missing) void onUnavailable(); }, [missing, onUnavailable]);
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
  const failure = details.find((query) => query.isError && !(query.error instanceof ApiError && query.error.status === 404));
  return <>
    {missing && <p role="status">An activity is unavailable. Refreshing the schedule…</p>}
    {failure && <TripError error={failure.error} retry={() => { details.filter((query) => query.isError).forEach((query) => void query.refetch()); }} />}
    <ul className="space-y-4">{conflicts.map((conflict) => <li key={conflict.activity_ids.join("-")} className="space-y-2 border-b pb-4 last:border-0 last:pb-0">
      <p className="break-words font-medium">{title(conflict.activity_ids[0])} and {title(conflict.activity_ids[1])}</p>
      <p className="text-sm"><time dateTime={conflict.overlap_starts_at}>{formatActivityTime(conflict.overlap_starts_at, trip.time_zone)}</time> – <time dateTime={conflict.overlap_ends_at}>{formatActivityTime(conflict.overlap_ends_at, trip.time_zone)}</time></p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="min-h-11" onClick={() => onViewDay(localDate(conflict.overlap_starts_at, trip.time_zone))}>View day</Button>
        {onEdit && conflict.activity_ids.map((id) => <Button key={id} type="button" variant="ghost" className="min-h-11" disabled={!activityFor(id)} onClick={() => { const activity = activityFor(id); if (activity) onEdit(activity); }}>Edit {title(id)}</Button>)}
      </div>
    </li>)}</ul>
  </>;
}
