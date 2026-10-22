"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Temporal } from "@js-temporal/polyfill";
import { TZDate } from "react-day-picker";
import { MapPin, CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, Plus, Coffee, Utensils, Plane, Sparkles, Tag, type LucideIcon } from "lucide-react";
import { TripDialog } from "./trip-dialog";
import { ApiError } from "@/lib/api";
import { activityCategories, type Activity, type ActivityConflict, useItineraryApi } from "@/lib/itinerary";
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

const categoryIcons: Record<string, LucideIcon> = { Rest: Coffee, Eating: Utensils, Travel: Plane, Activity: Sparkles };

function CategoryBadge({ category }: { category: string }) {
  const Icon = Object.hasOwn(categoryIcons, category) ? categoryIcons[category] : Tag;
  return <span className="activity-category" data-category={category}><Icon aria-hidden="true" className="size-3.5 shrink-0" /><span className="min-w-0 break-words">{category}</span></span>;
}

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
  const [editing, setEditing] = useState<Activity | { date: string; startsAt?: string; category: string } | null>(null);
  const [editDirty, setEditDirty] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const titleInput = useRef<HTMLInputElement>(null);
  const editTrigger = useRef<HTMLButtonElement | null>(null);
  const selectedHeading = useRef<HTMLHeadingElement>(null);
  const [deleting, setDeleting] = useState<Activity | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const detailTrigger = useRef<HTMLButtonElement | null>(null);
  function setSelected(date: string) {
    setViewing(null);
    setSelectedDate(date);
  }
  const selected = selectedDate < trip.start_date ? trip.start_date : selectedDate > trip.end_date ? trip.end_date : selectedDate;
  const dates = visibleDates(trip.start_date, trip.end_date, selected);
  const from = boundary(dates[0], trip.time_zone);
  const before = boundary(moveDate(dates[dates.length - 1], 1), trip.time_zone);
  const activities = useQuery({ queryKey: ["trip", trip.id, "activities", "board", from, before], queryFn: ({ signal }) => api.listRange(from, before, signal), retry: false });
  const conflicts = useQuery({ queryKey: ["trip", trip.id, "conflicts", "all"], queryFn: ({ signal }) => api.conflicts(signal), retry: false });
  const dayStart = boundary(selected, trip.time_zone);
  const dayEnd = boundary(moveDate(selected, 1), trip.time_zone);
  const dayConflicts = conflicts.data?.filter((conflict) => Temporal.Instant.compare(conflict.overlap_starts_at, dayEnd) < 0 && Temporal.Instant.compare(conflict.overlap_ends_at, dayStart) > 0) ?? [];
  useEffect(() => {
    const failure = [activities.error, conflicts.error].find((error) => error instanceof ApiError && error.status === 404);
    if (failure) void onFailure(failure);
  }, [activities.error, conflicts.error, onFailure]);
  const unavailable = [activities.error, conflicts.error].some((error) => error instanceof ApiError && error.status === 404);
  const viewedActivity = !unavailable && !activities.isError ? activities.data?.find((activity) => activity.id === viewing && localDate(activity.starts_at, trip.time_zone) === selected) : undefined;
  if (viewing !== null && !activities.isPending && !viewedActivity) setViewing(null);
  const viewedCreator = participants?.find((person) => person.user_id === viewedActivity?.created_by_user_id);
  const returnFocus = (trigger: HTMLButtonElement | null) => trigger?.isConnected && !trigger.disabled && trigger.getClientRects().length ? trigger : selectedHeading.current;
  const editedActivity = editing && "id" in editing ? editing : null;
  const newDate = editing && "date" in editing ? editing.date : undefined;
  const [year, month, day] = selected.split("-").map(Number);
  const today = Temporal.Now.zonedDateTimeISO(trip.time_zone).toPlainDate().toString();
  const dayNumber = Temporal.PlainDate.from(selected).since(Temporal.PlainDate.from(trip.start_date)).days + 1;
  const dayCount = Temporal.PlainDate.from(trip.end_date).since(Temporal.PlainDate.from(trip.start_date)).days + 1;
  function addActivity(date: string, trigger: HTMLButtonElement, category = "Activity") {
    const dayActivities = activities.data?.filter((activity) => localDate(activity.starts_at, trip.time_zone) === date) ?? [];
    const latestEnd = dayActivities.reduce<string | undefined>((latest, activity) => !latest || Temporal.Instant.compare(activity.ends_at, latest) > 0 ? activity.ends_at : latest, undefined);
    editTrigger.current = trigger; api.reset(); setEditDirty(false); setSaveMessage("");
    setEditing({ date, startsAt: latestEnd && localDate(latestEnd, trip.time_zone) === date ? latestEnd : undefined, category });
  }
  const closeEditor = () => {
    if (api.pending) return;
    if (editDirty && !window.confirm("Discard your unsaved activity changes?")) return;
    api.reset(); setEditDirty(false); setEditing(null);
  };

  const dayTools = <nav aria-label={`Tools for ${dateLabel(selected)}`} className="flex flex-wrap gap-2">
        <TripDialog title={`Places on ${dateLabel(selected)}`} description="Places attached to activities on the selected day."
          trigger={<Button variant="outline" className="min-h-11 xl:hidden"><MapPin aria-hidden="true" />View map</Button>}>
          {activities.isPending ? <p role="status">Loading places...</p> : activities.isError ? <TripError error={activities.error} retry={() => void activities.refetch()} /> : <TripMap activities={activities.data.filter((activity) => localDate(activity.starts_at, trip.time_zone) === selected)} />}
        </TripDialog>
        <TripDialog title={`Conflicts on ${dateLabel(selected)}`} description="Overlapping activities on this day." open={conflictsOpen} onOpenChange={setConflictsOpen}
          trigger={<Button variant="outline" className="min-h-11"><CalendarCheck aria-hidden="true" />Conflicts{(conflicts.isError || dayConflicts.length > 0) && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{conflicts.isError ? "Unavailable" : dayConflicts.length}</span>}</Button>}>
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
    <header className="planning-header">
      <div className="min-w-0 flex-1">{header}</div>
      <nav aria-label="Trip tools" className="hidden shrink-0 flex-wrap gap-2 md:flex">
        {tools}
      </nav>
    </header>
    <div className="planning-workspace"><section aria-labelledby="itinerary-heading" className="min-w-0 space-y-3">
    <div className="itinerary-toolbar sticky z-30 -mx-6 space-y-3 border-b px-6 py-3 md:static md:mx-0 md:px-0">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="itinerary-heading" className="text-xl font-semibold tracking-tight">Itinerary</h2>
      <div className="flex w-full min-w-0 items-center gap-2 md:w-auto">

        <Button type="button" variant="outline" className="size-12 shrink-0 md:size-11" disabled={selected <= trip.start_date} onClick={() => setSelected(moveDate(selected, -1))} aria-label="Previous date"><ChevronLeft aria-hidden="true" /></Button>
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
        <Button type="button" variant="outline" className="size-12 shrink-0 md:size-11" disabled={selected >= trip.end_date} onClick={() => setSelected(moveDate(selected, 1))} aria-label="Next date"><ChevronRight aria-hidden="true" /></Button>
      </div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2"><p role="status" aria-live="polite" className="text-sm text-muted-foreground">Day {dayNumber} of {dayCount}</p>
        {today >= trip.start_date && today <= trip.end_date && selected !== today && <Button type="button" variant="ghost" onClick={() => setSelected(today)}>Today</Button>}
      </div>
      {dayTools}
    </div>
    </div>

    <p className="break-words text-sm text-muted-foreground">All times in {trip.time_zone}.</p>
    <p role="status" aria-live="polite" className="sr-only">{saveMessage}</p>
    {api.error && !editing && !deleting && <TripError error={api.error} />}
    <TripDialog open={!!editing && canEdit} title={editedActivity ? "Edit activity" : "Add activity"}
      description={`${newDate ? `${dateLabel(newDate)} · ` : ""}Times in ${trip.time_zone}.`} busy={api.pending} disablePointerDismissal
      initialFocus={titleInput} finalFocus={() => returnFocus(editTrigger.current)}
      onOpenChange={(open) => { if (!open) closeEditor(); }}>
      {editing && <ActivityForm titleRef={titleInput} key={newDate ?? editedActivity?.id} initialValue={editedActivity ?? undefined} initialDate={newDate} initialStartsAt={editing && "date" in editing ? editing.startsAt : undefined}
        initialCategory={editing && "date" in editing ? editing.category : undefined}
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
        <div aria-label="Trip dates" className="itinerary-board pb-3">
          {[selected].map((date) => {
            const dayActivities = activities.data.filter((activity) => localDate(activity.starts_at, trip.time_zone) === date).sort((a, b) => Temporal.Instant.compare(a.starts_at, b.starts_at));
            return <section key={date} data-date={date} aria-label={dateLabel(date)} className="day-column min-h-64">
              <div className="flex flex-wrap items-center justify-between gap-3 py-3">
                <h3 id={`day-${date}-heading`} ref={selectedHeading} tabIndex={-1} className="min-w-0 outline-none focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-ring">
                  <time dateTime={date} className="font-semibold">{dateLabel(date)}</time>
                  <span className="ml-2 text-sm text-muted-foreground">{dayActivities.length} {dayActivities.length === 1 ? "activity" : "activities"}</span>
                </h3>
                {canEdit && <Button type="button" className="hidden md:inline-flex" disabled={api.pending || editing !== null}
                  onClick={(event) => addActivity(date, event.currentTarget)}><Plus aria-hidden="true" />Add activity</Button>}
              </div>
              {canEdit && <div role="group" aria-label={`Quick add for ${dateLabel(date)}`} className="flex flex-wrap items-center gap-2 pb-2">
                <span className="w-full text-xs text-muted-foreground">Quick add</span>
                {[...activityCategories, "Custom"].map((category) => <Button key={category} type="button" variant="outline" className="min-h-11" aria-label={`Add ${category} activity`}
                  disabled={api.pending || editing !== null} onClick={(event) => addActivity(date, event.currentTarget, category === "Custom" ? "" : category)}>{category}</Button>)}
              </div>}
              <div id={`day-${date}-details`} role="region" aria-labelledby={`day-${date}-heading`} className="space-y-3 pt-3">
              {dayActivities.length === 0 ? <p className="surface p-6 text-sm leading-6 text-muted-foreground">Nothing planned yet. {canEdit ? "Add an activity to start this day." : "Activities will appear here when an editor adds them."}</p> :
                <ul className="space-y-3">{dayActivities.map((activity) => {
                  return <li key={activity.id} className="timeline-entry"><p className="timeline-time"><time dateTime={activity.starts_at}>{timeLabel(activity.starts_at, trip.time_zone)}</time></p><Card className="relative min-w-0 gap-0 ring-0"><CardContent className="space-y-2 px-3">
                    <button type="button" className="absolute inset-0 cursor-pointer rounded-2xl outline-none transition-colors duration-150 hover:bg-muted/30 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring" aria-label={`View details for ${activity.title}`} aria-haspopup="dialog"
                      onClick={(event) => { detailTrigger.current = event.currentTarget; setViewing(activity.id); }} />
                    <div className="pointer-events-none relative space-y-2">
                    <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <p className="text-xs leading-5 font-medium tabular-nums text-muted-foreground"><time dateTime={activity.starts_at}>{timeLabel(activity.starts_at, trip.time_zone)}</time> – <time dateTime={activity.ends_at}>{timeLabel(activity.ends_at, trip.time_zone)}</time>{localDate(activity.ends_at, trip.time_zone) > date && <span className="text-muted-foreground"> · ends next day</span>}</p>
                      <CategoryBadge category={activity.category} />
                    </div>
                    <h4 className="break-words text-base leading-6 font-semibold">{activity.title}</h4>
                    </div>
                    {activity.place && <p className="flex items-start gap-2 text-sm text-muted-foreground"><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span className="min-w-0 break-words">{activity.place.name}</span></p>}
                    </div>
                  </CardContent></Card></li>;
                })}</ul>}
              </div>
            </section>;
          })}
        </div>
      </>)}
    {canEdit && !unavailable && activities.isSuccess && <div className="mobile-add-activity fixed inset-x-0 z-30 border-t bg-background px-6 py-3 md:hidden">
      <Button className="min-h-12 w-full" disabled={api.pending || editing !== null} onClick={(event) => addActivity(selected, event.currentTarget)}><Plus aria-hidden="true" />Add activity</Button>
    </div>}
    <TripDialog title={viewedActivity?.title ?? "Activity details"} description={viewedActivity ? `${formatActivityTime(viewedActivity.starts_at, trip.time_zone)} – ${formatActivityTime(viewedActivity.ends_at, trip.time_zone)} · ${trip.time_zone}` : "Activity details"}
      open={!!viewedActivity} onOpenChange={(open) => { if (!open) setViewing(null); }} finalFocus={() => editing || deleting ? false : returnFocus(detailTrigger.current)}>
      {viewedActivity && <div className="space-y-6">
        <CategoryBadge category={viewedActivity.category} />
        {viewedActivity.place && <section className="space-y-2"><h3 className="text-sm font-medium">Place</h3><p className="break-words">{viewedActivity.place.name}</p>{viewedActivity.place.address && <p className="break-words text-sm text-muted-foreground">{viewedActivity.place.address}</p>}</section>}
        {viewedActivity.notes && <section className="space-y-2"><h3 className="text-sm font-medium">Notes</h3><p className="whitespace-pre-wrap break-words text-sm leading-6">{viewedActivity.notes}</p></section>}
        {viewedActivity.checklist.length > 0 && <section className="space-y-2"><h3 className="text-sm font-medium">To do</h3><ul className="list-disc space-y-2 pl-5 text-sm leading-6">{viewedActivity.checklist.map((item, index) => <li key={index} className="whitespace-pre-wrap break-words">{item.text}</li>)}</ul></section>}
        <p className="break-words text-xs text-muted-foreground">{participants ? `Created by ${viewedCreator ? participantName(viewedCreator) : "Former participant"}` : "Creator unavailable"}</p>
        {canEdit && <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
          <Button disabled={api.pending || editing !== null} aria-label={`Edit ${viewedActivity.title}`} onClick={() => { editTrigger.current = detailTrigger.current; api.reset(); setEditDirty(false); setSaveMessage(""); setEditing(viewedActivity); setViewing(null); }}>Edit</Button>
          <Button variant="ghost" className="text-destructive" disabled={api.pending || editing !== null} aria-label={`Delete ${viewedActivity.title}`} onClick={() => { api.reset(); setDeleting(viewedActivity); setViewing(null); }}>Delete</Button>
        </div>}
      </div>}
    </TripDialog>
    {deleting && canEdit && <AlertDialog open onOpenChange={(open) => { if (!open && !api.pending) { api.reset(); setDeleting(null); } }}>
      <AlertDialogContent className="w-[calc(100%-2rem)]" finalFocus={() => returnFocus(detailTrigger.current)}>
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
  </section><aside className="planning-map" aria-label="Selected day map"><h2 className="text-lg font-semibold tracking-tight">Places for this day</h2><p className="mt-1 mb-5 text-sm text-muted-foreground">Your selected activities, on the map.</p>{activities.isPending ? <p role="status">Loading places...</p> : activities.isError ? <TripError error={activities.error} retry={() => void activities.refetch()} /> : <TripMap activities={activities.data.filter((activity) => localDate(activity.starts_at, trip.time_zone) === selected)} />}</aside></div></>;
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
