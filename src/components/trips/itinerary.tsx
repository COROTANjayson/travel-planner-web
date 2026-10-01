"use client";

import { useEffect, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { activityPageSize, type Activity, type ActivityConflict, useItineraryApi } from "@/lib/itinerary";
import { formatActivityTime } from "@/lib/activity-time";
import { participantName, type Participant } from "@/lib/memberships";
import { type Trip } from "@/lib/trips";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ActivityForm } from "./activity-form";
import { TripError } from "./trip-states";

function Pagination({ label, offset, count, fetching, onChange }: {
  label: string; offset: number; count: number; fetching: boolean; onChange: (offset: number) => void;
}) {
  return <nav aria-label={`${label} pagination`} className="flex flex-wrap items-center gap-3">
    <Button className="min-h-11" variant="outline" disabled={offset === 0 || fetching} onClick={() => onChange(Math.max(0, offset - activityPageSize))}>Previous</Button>
    <span className="text-sm" aria-live="polite">Page {offset / activityPageSize + 1}</span>
    <Button className="min-h-11" variant="outline" disabled={count < activityPageSize || fetching} onClick={() => onChange(offset + activityPageSize)}>Next</Button>
  </nav>;
}

export function Itinerary({ trip, participants, canEdit, onFailure }: {
  trip: Trip; participants?: Participant[]; canEdit: boolean; onFailure: (error: Error) => void | Promise<void>;
}) {
  const api = useItineraryApi(trip.id, onFailure);
  const [offset, setOffset] = useState(0);
  const [conflictOffset, setConflictOffset] = useState(0);
  const [editing, setEditing] = useState<Activity | "new" | null>(null);
  const [deleting, setDeleting] = useState<Activity | null>(null);
  const activities = useQuery({ queryKey: ["trip", trip.id, "activities", offset], queryFn: ({ signal }) => api.list(offset, signal), retry: false });
  const conflicts = useQuery({ queryKey: ["trip", trip.id, "conflicts", conflictOffset], queryFn: ({ signal }) => api.conflicts(conflictOffset, signal), retry: false });
  useEffect(() => {
    const failure = [activities.error, conflicts.error].find((error) => error instanceof ApiError && error.status === 404);
    if (failure) void onFailure(failure);
  }, [activities.error, conflicts.error, onFailure]);
  const unavailable = [activities.error, conflicts.error].some((error) => error instanceof ApiError && error.status === 404);

  return <section aria-labelledby="itinerary-heading" className="min-w-0 space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="itinerary-heading" className="text-xl font-semibold">Itinerary</h2>
      {canEdit && <Button className="min-h-11" disabled={api.pending || editing !== null} onClick={() => { api.reset(); setEditing("new"); }}>Add activity</Button>}
    </div>
    <p className="text-sm text-muted-foreground">Activity dates must be within {trip.start_date} – {trip.end_date} in each activity’s time zone.</p>
    {api.error && !editing && !deleting && <TripError error={api.error} />}
    {editing && <Card hidden={!canEdit}><CardHeader><CardTitle>{editing === "new" ? "New activity" : "Edit activity"}</CardTitle></CardHeader><CardContent>
      <ActivityForm key={editing === "new" ? "new" : editing.id} initialValue={editing === "new" ? undefined : editing}
        tripZone={trip.time_zone} pending={api.pending || !canEdit} error={api.error} onCancel={() => { api.reset(); setEditing(null); }}
        onSubmit={async (input) => {
          if (!canEdit || api.pending) return;
          try { if (await api.save(input, editing === "new" ? undefined : editing.id)) setEditing(null); }
          catch { /* The form retains its values and displays the API error. */ }
        }} />
    </CardContent></Card>}
    {!unavailable && (activities.isPending ? <p role="status">Loading activities…</p> : activities.isError ?
      <TripError error={activities.error} retry={() => void activities.refetch()} pending={activities.isFetching} /> : <>
        {activities.data.length === 0 ? <p className="text-muted-foreground">{offset === 0 ? "No activities yet." : "No activities on this page. Go back to the previous page."}</p> :
          <ul className="space-y-4">{activities.data.map((activity) => {
            const creator = participants?.find((person) => person.user_id === activity.created_by_user_id);
            return <li key={activity.id}><Card><CardContent className="space-y-3">
              <h3 className="break-words font-semibold">{activity.title}</h3>
              <p className="text-sm"><time dateTime={activity.starts_at}>{formatActivityTime(activity.starts_at, activity.time_zone)}</time> – <time dateTime={activity.ends_at}>{formatActivityTime(activity.ends_at, activity.time_zone)}</time></p>
              <p className="break-words text-sm text-muted-foreground">{activity.time_zone}</p>
              {activity.notes && <p className="whitespace-pre-wrap break-words text-sm">{activity.notes}</p>}
              <p className="break-words text-sm text-muted-foreground">{participants ? `Created by ${creator ? participantName(creator) : "Former participant"}` : "Creator unavailable"}</p>
              {canEdit && <div className="flex flex-wrap gap-3">
                <Button className="min-h-11" variant="outline" disabled={api.pending || editing !== null} aria-label={`Edit ${activity.title}`} onClick={() => { api.reset(); setEditing(activity); }}>Edit</Button>
                <Button className="min-h-11" variant="outline" disabled={api.pending || editing !== null} aria-label={`Delete ${activity.title}`} onClick={() => { api.reset(); setDeleting(activity); }}>Delete</Button>
              </div>}
            </CardContent></Card></li>;
          })}</ul>}
        <Pagination label="Activities" offset={offset} count={activities.data.length} fetching={activities.isFetching || api.pending} onChange={setOffset} />
      </>)}
    {!unavailable && <Card><CardHeader><CardTitle>Schedule conflicts</CardTitle></CardHeader><CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">Overlaps are advisory. Parallel activities are allowed. Overlap times below use {trip.time_zone}.</p>
      {conflicts.isPending ? <p role="status">Loading conflicts…</p> : conflicts.isError ?
        <TripError error={conflicts.error} retry={() => void conflicts.refetch()} pending={conflicts.isFetching} /> : <>
          {conflicts.data.length === 0 ? <p className="text-muted-foreground">{conflictOffset === 0 ? "No schedule conflicts." : "No conflicts on this page. Go back to the previous page."}</p> :
            <ConflictList trip={trip} conflicts={conflicts.data} loaded={activities.data ?? []} onUnavailable={api.refresh} />}
          <Pagination label="Conflicts" offset={conflictOffset} count={conflicts.data.length} fetching={conflicts.isFetching || api.pending} onChange={setConflictOffset} />
        </>}
    </CardContent></Card>}
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
  </section>;
}

function ConflictList({ trip, conflicts, loaded, onUnavailable }: {
  trip: Trip; conflicts: ActivityConflict[]; loaded: Activity[]; onUnavailable: () => Promise<void>;
}) {
  const api = useItineraryApi(trip.id, () => {});
  const missingIDs = Array.from(new Set(conflicts.flatMap((conflict) => conflict.activity_ids))).filter((id) => !loaded.some((activity) => activity.id === id));
  const details = useQueries({ queries: missingIDs.map((id) => ({
    queryKey: ["trip", trip.id, "activity", id], queryFn: ({ signal }: { signal: AbortSignal }) => api.get(id, signal), retry: false,
  })) });
  const missing = details.some((query) => query.error instanceof ApiError && query.error.status === 404);
  useEffect(() => { if (missing) void onUnavailable(); }, [missing, onUnavailable]);
  function title(id: number) {
    const known = loaded.find((activity) => activity.id === id);
    if (known) return known.title;
    const detail = details[missingIDs.indexOf(id)];
    return detail?.data?.title ?? (detail?.isError ? "Activity unavailable" : "Loading activity…");
  }
  const failure = details.find((query) => query.isError && !(query.error instanceof ApiError && query.error.status === 404));
  return <>
    {missing && <p role="status">An activity is unavailable. Refreshing the schedule…</p>}
    {failure && <TripError error={failure.error} retry={() => { details.filter((query) => query.isError).forEach((query) => void query.refetch()); }} />}
    <ul className="space-y-4">{conflicts.map((conflict) => <li key={conflict.activity_ids.join("-")} className="space-y-2 border-b pb-4 last:border-0 last:pb-0">
      <p className="break-words font-medium">{title(conflict.activity_ids[0])} and {title(conflict.activity_ids[1])}</p>
      <p className="text-sm"><time dateTime={conflict.overlap_starts_at}>{formatActivityTime(conflict.overlap_starts_at, trip.time_zone)}</time> – <time dateTime={conflict.overlap_ends_at}>{formatActivityTime(conflict.overlap_ends_at, trip.time_zone)}</time></p>
    </li>)}</ul>
  </>;
}
