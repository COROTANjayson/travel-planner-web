// Run with: node scripts/check-itinerary.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const require = createRequire(import.meta.url);
let confirmDiscard = false;
function load(file, mocks = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const context = { exports: {}, require: (id) => mocks[id] || require(id), Date, Intl, Error, window: { confirm: () => confirmDiscard } };
  vm.runInNewContext(compiled, context);
  return context.exports;
}
const time = load("src/lib/activity-time.ts");
const precise = "2026-10-01T01:23:45.123456Z";
const local = time.instantToLocal(precise, "Asia/Manila");
assert.equal(local.value, "2026-10-01T09:23:45.123456");
assert.equal(time.dateTimeInputValue(local.value), "2026-10-01T09:23:45.123");
assert.equal(time.localToInstant(local.value, "Asia/Manila"), precise);
assert.equal(time.localToInstant("2026-10-01T09:00", "Asia/Manila"), "2026-10-01T01:00:00Z");
assert.equal(time.localToInstant("2026-10-01T23:30", "America/Los_Angeles"), "2026-10-02T06:30:00Z");
assert.throws(() => time.localToInstant("", "UTC"), /required/);
assert.throws(() => time.localToInstant("2026-03-08T02:30", "America/New_York"), /does not exist/);
assert.throws(() => time.localToInstant("2026-11-01T01:30", "America/New_York"), /occurs twice/);
assert.throws(() => time.localToInstant("invalid", "Asia/Manila"), /valid/);
assert.throws(() => time.localToInstant("2026-10-01T09:00", "Unknown/Zone"), /valid/);
assert.equal(time.localToInstant("2026-03-08T01:30", "America/New_York"), "2026-03-08T06:30:00Z");
assert.equal(time.localToInstant("2026-03-08T03:30", "America/New_York"), "2026-03-08T07:30:00Z");
assert.equal(time.localToInstant("2026-11-01T01:30", "America/New_York", "earlier"), "2026-11-01T05:30:00Z");
assert.equal(time.localToInstant("2026-11-01T01:30", "America/New_York", "later"), "2026-11-01T06:30:00Z");
assert.equal(time.endAfterMinutes("2026-03-08T06:30:00Z", 60), "2026-03-08T07:30:00Z", "A one-hour duration crosses the spring DST jump as elapsed time");
assert.equal(time.endAfterMinutes("2026-11-01T05:30:00Z", 60), "2026-11-01T06:30:00Z", "A one-hour duration crosses the repeated hour as elapsed time");
for (const occurrence of ["earlier", "later"]) {
  const instant = time.localToInstant("2026-11-01T01:30:00.123456", "America/New_York", occurrence);
  const edited = time.instantToLocal(instant, "America/New_York");
  assert.equal(edited.occurrence, occurrence);
  assert.equal(time.localToInstant(edited.value, "America/New_York", edited.occurrence), instant);
}
const converted = time.instantToLocal(precise, "America/New_York");
assert.equal(time.localToInstant(converted.value, "America/New_York", converted.occurrence), precise);
const priorTZ = process.env.TZ;
try {
  for (const deviceZone of ["UTC", "America/Los_Angeles", "Asia/Tokyo"]) {
    process.env.TZ = deviceZone;
    assert.equal(time.localToInstant(local.value, "Asia/Manila"), precise);
    assert.equal(time.instantToLocal(precise, "Asia/Manila").value, local.value);
    assert.match(time.formatActivityTime(precise, "Asia/Manila"), /9:23|09:23/);
  }
} finally { if (priorTZ === undefined) delete process.env.TZ; else process.env.TZ = priorTZ; }

class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
let calls = [], response, failure;
const client = Object.fromEntries(["invalidateQueries", "cancelQueries", "removeQueries", "setQueryData"].map((method) => [method, async (...args) => calls.push([method, ...args])]));
const apiMock = { ApiError, useApi: () => async (path, init) => {
  calls.push([path, init]);
  if (failure) throw failure;
  return typeof response === "function" ? response(path, init) : response;
} };
const trips = load("src/lib/trips.ts", { "@/lib/api": apiMock });
const range = (start, end) => trips.formatTripDates(start, end, "en-GB").replace(/\s+/g, " ").replace(/\s*–\s*/g, "–");
assert.equal(range("2026-10-08", "2026-10-10"), "8–10 Oct 2026");
assert.equal(range("2026-10-08", "2026-10-08"), "8 Oct 2026");
assert.match(range("2026-10-30", "2026-11-02"), /30 Oct.*2 Nov 2026/);
assert.match(range("2026-12-31", "2027-01-02"), /31 Dec 2026.*2 Jan 2027/);
assert.match(trips.formatTripDates("2026-10-08", "2026-10-10", "en-US"), /Oct.*8.*10.*2026/);
let tripQuery = { data: [] };
const tripPage = load("src/app/trips/page.tsx", {
  react: { ...React, useState: (initial) => [initial, () => {}] },
  "next/link": { default: ({ children, href }) => React.createElement("a", { href }, children) },
  "@tanstack/react-query": { useQuery: () => tripQuery },
  "@/lib/trips": trips,
  "@/components/ui/button": { Button: ({ children, disabled }) => React.createElement("button", { disabled }, children) },
  "@/components/ui/card": Object.fromEntries(["Card", "CardContent", "CardDescription", "CardHeader", "CardTitle"].map((key) => [key, ({ children }) => React.createElement("div", null, children)])),
  "@/components/trips/trip-states": { TripError() {}, TripLoading() {} },
});
const today = require("@js-temporal/polyfill").Temporal.Now.plainDateISO("UTC");
const tripFor = (id, start, end) => ({ id, start_date: start.toString(), end_date: end.toString(), time_zone: "UTC" });
assert.equal(trips.orderTrips([
  tripFor(1, today.subtract({ days: 4 }), today.subtract({ days: 2 })),
  tripFor(2, today.add({ days: 2 }), today.add({ days: 4 })),
  tripFor(3, today.subtract({ days: 1 }), today.add({ days: 1 })),
]).map((trip) => trip.id).join(","), "3,2,1", "Ongoing and upcoming trips precede past trips");
const tripListHtml = () => renderToStaticMarkup(tripPage.default());
assert.match(tripListHtml(), /No trips yet/);
assert.doesNotMatch(tripListHtml(), /aria-label="Trip pages"/, "Empty lists have no pagination controls");
tripQuery = { data: [{ ...tripFor(1, today, today), name: "Cebu", destination: "Cebu City" }] };
assert.match(tripListHtml(), /Open itinerary/);
assert.doesNotMatch(tripListHtml(), /lg:grid-cols-3/, "Sparse lists use wider cards on desktop");
tripQuery = { data: Array.from({ length: trips.tripPageSize }, (_, index) => ({
  ...tripFor(index + 1, today, today), name: `Trip ${index + 1}`, destination: "Cebu",
})) };
assert.doesNotMatch(tripListHtml(), /aria-label="Trip pages"/, "One page needs no pagination");
assert.match(tripListHtml(), /journey-cover/, "Trip cards retain their illustrated covers");
tripQuery.data.push({ ...tripFor(99, today, today), name: "Extra trip", destination: "Cebu" });
assert.match(tripListHtml(), /aria-label="Trip pages"/, "Multiple pages retain navigation");
const tripDraft = { name: " Manila ", destination_place_id: 7, starts_at: "2026-10-01T01:00:00Z", ends_at: "2026-10-01T01:00:00.001Z" };
assert.equal(trips.tripInput(tripDraft).name, "Manila");
assert.equal(trips.validateTrip(tripDraft), undefined, "Subsecond end time must compare as an instant");
assert.match(trips.validateTrip({ ...tripDraft, starts_at: tripDraft.ends_at, ends_at: tripDraft.starts_at }), /after/);
const datesOnly = { name: "Dates only", destination_place_id: 7, start_date: "2026-10-01", end_date: "2026-10-01", starts_at: null, ends_at: null };
assert.equal(trips.validateTrip(datesOnly), undefined);
assert.equal(trips.tripInput(datesOnly).starts_at, null);
assert.match(trips.validateTrip({ ...datesOnly, end_date: "2026-09-30" }), /after/);
assert.match(trips.validateTrip({ ...datesOnly, start_date: "2026-02-30" }), /valid/);
assert.match(trips.validateTrip({ ...datesOnly, starts_at: tripDraft.starts_at }), /both/);
const itinerary = load("src/lib/itinerary.ts", {
  react: { useCallback: (callback) => callback, useRef: (value) => ({ current: value }), useState: (value) => [value, () => {}] },
  "@/lib/api": apiMock, "@tanstack/react-query": { useQueryClient: () => client },
});
const activity = { id: 1, trip_id: 7, created_by_user_id: 11, title: "  Breakfast  ", starts_at: "2026-10-01T01:00:00Z", ends_at: "2026-10-01T02:00:00Z", time_zone: "Asia/Manila", notes: "Notes", place_id: null, place: null, created_at: precise, updated_at: precise };
assert.deepEqual(Object.keys(itinerary.activityInput(activity)).sort(), ["ends_at", "notes", "place_id", "starts_at", "time_zone", "title"]);
const denied = [];
const api = itinerary.useItineraryApi(7, (error) => denied.push(error.status));
const signal = new AbortController().signal;
response = [activity];
await api.list(10, signal);
assert.equal(calls[0][0], "/api/v1/trips/7/activities?limit=10&offset=10");
assert.equal(calls[0][1].signal, signal);
calls = [];
response = (path) => path.includes("offset=0") ? Array.from({ length: 100 }, () => activity) : [activity];
assert.equal((await api.listRange("2026-10-01T00:00:00Z", "2026-10-04T00:00:00Z", signal)).length, 101);
assert.equal(calls.length, 2, "The board must load every page in its date window");
assert.match(calls[0][0], /start_from=2026-10-01T00%3A00%3A00Z/);
assert.match(calls[1][0], /offset=100/);
assert.equal(calls[1][1].signal, signal);
calls = [];
response = [activity];
await api.conflicts(20, signal);
assert.equal(calls[0][0], "/api/v1/trips/7/activities/conflicts?limit=10&offset=20");
calls = [];
response = activity;
await api.get(1);
assert.equal(calls[0][0], "/api/v1/trips/7/activities/1");
for (const id of [undefined, 1]) {
  calls = [];
  const saved = await api.save(activity, id);
  assert.equal(saved.id, 1);
  assert.equal(calls[0][1].method, id === undefined ? "POST" : "PUT");
  const payload = JSON.parse(calls[0][1].body);
  assert.equal(payload.title, "Breakfast");
  assert.equal(payload.created_by_user_id, undefined);
  assert.equal(payload.id, undefined);
  assert.equal(calls[0][1].headers["Content-Type"], "application/json");
  assert.ok(calls.some((call) => call[0] === "setQueryData" && JSON.stringify(call[1]) === '["trip",7,"activity",1]'));
  assert.deepEqual(calls.filter((call) => call[0] === "invalidateQueries").map((call) => JSON.stringify(call[1].queryKey)).sort(), ['["trip",7,"activities"]', '["trip",7,"conflicts"]'].sort());
}
calls = [];
response = undefined;
assert.equal(await api.remove(1), true);
assert.equal(calls[0][1].method, "DELETE");
assert.ok(calls.some((call) => call[0] === "removeQueries" && JSON.stringify(call[1].queryKey) === '["trip",7,"activity",1]'));
failure = new ApiError(403, "Forbidden");
await assert.rejects(api.save(activity, 1), (error) => error.status === 403);
assert.deepEqual(denied, [403]);
calls = [];
failure = new ApiError(404, "Not found");
await assert.rejects(api.remove(1), (error) => error.message.includes("activity is unavailable"));
assert.deepEqual(denied, [403], "Individual activity 404 must not hide the trip");
assert.equal(calls.filter((call) => call[0] === "invalidateQueries").length, 2);
failure = new ApiError(400, "activity local dates must fall within trip dates");
await assert.rejects(api.save(activity), /activity local dates/);
failure = undefined;
let finish;
response = new Promise((resolve) => { finish = resolve; });
calls = [];
const first = api.save(activity);
await api.save(activity);
assert.equal(calls.length, 1, "Duplicate submissions must be blocked before rerender");
finish(activity);
await first;

const wrap = (tag) => function Primitive({ children }) { return React.createElement(tag, null, children); };
const primitiveMocks = {
  "@/components/ui/button": { Button: wrap("button") },
  "@/components/ui/card": Object.fromEntries(["Card", "CardContent", "CardHeader", "CardTitle"].map((key) => [key, wrap("div")])),
  "@/components/ui/alert-dialog": {},
  "./trip-dialog": { TripDialog: ({ children, open }) => open === false ? null : React.createElement("section", null, children) },
  "./activity-form": {}, "./trip-states": { TripError: () => React.createElement("p", null, "Error") },
};
const formModule = load("src/components/trips/activity-form.tsx", {
  ...primitiveMocks,
  "@/lib/api": apiMock,
  "@tanstack/react-query": { useQuery: () => ({ data: [], isPending: false, isError: false }) },
  react: { useId: () => "activity", useState: (value) => [typeof value === "function" ? value() : value, () => {}] },
  "@/lib/activity-time": time,
  "./date-time-field": { DateTimeField: ({ draft }) => React.createElement("input", { value: draft.value, readOnly: true }) },
  "@/components/ui/alert": { Alert: wrap("div"), AlertDescription: wrap("p") },
  "@/components/ui/input": { Input: (props) => React.createElement("input", props) },
  "@/components/ui/label": { Label: wrap("label") },
  "@/components/ui/select": Object.fromEntries(["Select", "SelectContent", "SelectItem", "SelectTrigger", "SelectValue"].map((key) => [key, wrap("div")])),
});
const tripFormModule = load("src/components/trips/trip-form.tsx", {
  ...primitiveMocks, "@/lib/api": apiMock, "@/lib/activity-time": time, "@/lib/trips": trips,
  react: { useState: (value) => [typeof value === "function" ? value() : value, () => {}] },
  "./date-time-field": { DateTimeField: () => null },
  "@/components/ui/alert": { Alert: wrap("div"), AlertDescription: wrap("p") },
  "@/components/ui/input": { Input: (props) => React.createElement("input", props) },
  "@/components/ui/label": { Label: wrap("label") },
});
let submittedTrip;
const dateOnlyForm = tripFormModule.TripForm({ initialValue: { ...datesOnly, destination: "Cebu", time_zone: "Asia/Manila" }, onSubmit: (input) => { submittedTrip = input; }, pending: false, submitLabel: "Save changes" });
assert.match(renderToStaticMarkup(dateOnlyForm), /type="date"/);
assert.match(renderToStaticMarkup(dateOnlyForm), /Add exact start and end times/);
dateOnlyForm.props.onSubmit({ preventDefault() {} });
assert.equal(submittedTrip.start_date, datesOnly.start_date);
assert.equal(submittedTrip.ends_at, null, "Date-only form does not invent exact times");
const exactTripForm = tripFormModule.TripForm({ initialValue: { ...datesOnly, ...tripDraft, destination: "Cebu", time_zone: "Asia/Manila" }, onSubmit: (input) => { submittedTrip = input; }, pending: false, submitLabel: "Save changes" });
exactTripForm.props.onSubmit({ preventDefault() {} });
assert.equal(submittedTrip.ends_at, tripDraft.ends_at, "Editing an exact-time trip preserves timestamp precision");
let submitted;
const form = formModule.ActivityForm({ initialValue: { ...activity, starts_at: precise }, tripID: 7, tripStart: "2026-10-01", tripEnd: "2026-10-03", tripStartsAt: null, tripEndsAt: null, tripZone: "Asia/Manila", onSubmit: (input) => { submitted = input; }, onCancel: () => {}, pending: false });
const formHtml = renderToStaticMarkup(form);
assert.match(formHtml, /value="2026-10-01T09:23:45\.123456"/);
assert.doesNotMatch(formHtml, /Activity time zone/);
assert.match(formHtml, /What are you doing/);
assert.match(formHtml, /e.g. Dinner at the waterfront/);
assert.match(formHtml, /Save changes/);
const newFormHtml = renderToStaticMarkup(formModule.ActivityForm({ tripID: 7, initialDate: "2026-10-02", tripStart: "2026-10-01", tripEnd: "2026-10-03", tripStartsAt: null, tripEndsAt: null, tripZone: "Asia/Manila", onSubmit: () => {}, onCancel: () => {}, pending: false }));
assert.match(newFormHtml, /value="2026-10-02T"/);
assert.match(newFormHtml, /1 hour/);
assert.doesNotMatch(newFormHtml, />60</);
assert.match(newFormHtml, /Add activity/);
form.props.onSubmit({ preventDefault() {} });
assert.equal(submitted.starts_at, precise, "Title-only edits must preserve precision despite the native input display");
const membership = load("src/lib/memberships.ts", { react: {}, "@/lib/api": apiMock, "@tanstack/react-query": {} });
const trip = { id: 7, start_date: "2026-10-01", end_date: "2026-10-03", time_zone: "Asia/Manila" };
const overnight = { ...activity, id: 2, title: "Late visit", starts_at: "2026-10-01T15:30:00Z", ends_at: "2026-10-01T16:30:00Z" };
let queryMode = "success";
let boardActivities = [activity, overnight];
let boardConflicts = [];
let uiState = null, hookIndex = 0, uiRefs = [], refIndex = 0;
const uiApi = { pending: false, reset() {}, async save() { return true; } };
const components = load("src/components/trips/itinerary.tsx", {
  ...primitiveMocks, "@/lib/api": apiMock, "@/lib/activity-time": time, "@/lib/memberships": membership,
  "@/components/ui/calendar": { Calendar: wrap("div") },
  "@/components/ui/popover": Object.fromEntries(["Popover", "PopoverContent", "PopoverTrigger"].map((key) => [key, wrap("div")])),
  "@/lib/itinerary": { ...itinerary, useItineraryApi: () => uiApi },
  "next/dynamic": { __esModule: true, default: () => () => React.createElement("div", null, "Map") },
  react: { ...React, useEffect: () => {},
    useState: (initial) => {
      // eslint-disable-next-line react-hooks/rules-of-hooks -- Test harness switches between SSR and direct handler checks.
      if (!uiState) return React.useState(initial);
      const index = hookIndex++;
      if (!(index in uiState)) uiState[index] = typeof initial === "function" ? initial() : initial;
      return [uiState[index], (value) => { uiState[index] = value; }];
    },
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Same test-only hook adapter as above.
    useRef: (initial) => uiState ? (uiRefs[refIndex++] ??= { current: initial }) : React.useRef(initial),
  },
  "@tanstack/react-query": { useQueryClient: () => client, useQueries: () => [], useQuery: ({ queryKey }) => ({
    isPending: queryMode === "pending", isSuccess: queryMode === "success" || queryMode === "empty", isError: queryMode === "error", isFetching: false,
    data: queryKey[2] === "activities" ? queryMode === "empty" ? [] : boardActivities : boardConflicts, error: new ApiError(500, "Failure"),
  }) },
});
for (const role of ["owner", "editor", "member", "viewer", undefined]) {
  const html = renderToStaticMarkup(React.createElement(components.Itinerary, { trip, participants: [], canEdit: membership.permissions(role).edit, onFailure: () => {} }));
  assert.equal(html.includes("+ Add activity"), role === "owner" || role === "editor");
  assert.equal(html.includes("Activity options"), role === "owner" || role === "editor");
  assert.match(html, /Former participant/);
  assert.match(html, /Trip dates/);
  assert.match(html, /dateTime="2026-10-01"/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /itinerary-board/);
  assert.match(html, /ends next day/);
  assert.doesNotMatch(html, /No schedule conflicts/, "Closed conflict dialog stays hidden");
  assert.match(html, /Day [123] of 3/);
}
for (const [mode, text] of [["pending", "Loading activities"], ["empty", "Nothing planned yet"], ["error", "Error"]]) {
  queryMode = mode;
  const html = renderToStaticMarkup(React.createElement(components.Itinerary, { trip, canEdit: false, onFailure: () => {} }));
  assert.ok(html.includes(text));
}
console.log("Itinerary timezone/DST/precision, board pagination, payloads, permissions, states and cache updates passed.");


// Exercise the board's actual event handlers without a browser or extra test dependencies.
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  return React.isValidElement(node) ? [node, ...nodes(node.props.children)] : [];
}
queryMode = "success";
uiState = [];
function board() {
  hookIndex = refIndex = 0;
  return nodes(components.Itinerary({ trip, participants: [], canEdit: true, onFailure() {} }));
}
const dialog = () => board().find((node) => node.props.disablePointerDismissal);
const trigger = { isConnected: true, disabled: false, getClientRects: () => [1] };
const dayToggle = (date) => board().find((node) => node.props.id === `day-${date}-heading`);
const dayPanel = (date) => board().find((node) => node.props.id === `day-${date}-details`);
boardConflicts = [
  { activity_ids: [1, 2], overlap_starts_at: "2026-10-01T15:30:00Z", overlap_ends_at: "2026-10-01T16:30:00Z" },
  { activity_ids: [3, 4], overlap_starts_at: "2026-10-01T15:00:00Z", overlap_ends_at: "2026-10-01T16:00:00Z" },
];
dayToggle("2026-10-01").props.onClick();
assert.ok(!dayPanel("2026-10-01").props.hidden);
assert.equal(dayPanel("2026-10-02"), undefined);
board().find((node) => node.props.children === "Fri, Oct 2").props.onClick();
board().find((node) => node.props.children === "Fri, Oct 2").props.onClick();
assert.ok(!dayPanel("2026-10-02").props.hidden);
assert.equal(board().find((node) => node.props.conflicts).props.conflicts.length, 1, "The second day includes a crossing overlap but excludes one ending at midnight");
assert.ok(board().some((node) => node.props["aria-label"] === "Tools for Fri, Oct 2"));
board().find((node) => node.props.children === "Fri, Oct 2").props.onClick();
assert.ok(!dayPanel("2026-10-02").props.hidden, "Selecting a day again keeps its activity cards visible");
board().find((node) => node.props.children === "Thu, Oct 1").props.onClick();
boardConflicts = [];
for (const [index, button] of board().filter((node) => node.props.children === "+ Add activity").entries()) {
  button.props.onClick({ currentTarget: trigger });
  assert.equal(dialog().props.open, true);
  assert.equal(dialog().props.children.props.initialDate, `2026-10-0${index + 1}`);
  assert.equal(dialog().props.initialFocus, dialog().props.children.props.titleRef);
  assert.equal(dialog().props.finalFocus(), trigger);
  dialog().props.children.props.onCancel();
  assert.equal(dialog().props.open, false);
}
board().find((node) => node.props["aria-label"] === `Actions for ${activity.title}`).props.onClick({ currentTarget: trigger });
board().find((node) => node.props["aria-label"] === `Edit ${activity.title}`).props.onClick();
assert.equal(dialog().props.children.props.initialValue, activity);
dialog().props.children.props.onDirty();
dialog().props.children.props.onCancel();
assert.equal(dialog().props.open, true, "Unsaved edits require discard confirmation");
confirmDiscard = true;
dialog().props.children.props.onCancel();
assert.equal(dialog().props.open, false, "Confirmed discard closes the editor");
board().find((node) => node.props["aria-label"] === `Actions for ${activity.title}`).props.onClick({ currentTarget: trigger });
board().find((node) => node.props["aria-label"] === `Edit ${activity.title}`).props.onClick();
uiApi.pending = true;
dialog().props.onOpenChange(false);
assert.equal(dialog().props.open, true, "Saving blocks dismissal");
uiApi.pending = false;
uiApi.save = async () => { throw new Error("Save failed"); };
await dialog().props.children.props.onSubmit(activity);
assert.equal(dialog().props.open, true, "Failed save retains the editor");
assert.equal(dialog().props.children.props.initialValue, activity);
uiApi.save = async () => true;
await dialog().props.children.props.onSubmit({ ...activity, starts_at: "2026-10-02T01:00:00Z" });
assert.equal(dialog().props.open, false);
assert.equal(uiState[0], "2026-10-02", "Save selects the destination day");
trigger.isConnected = false;
const heading = {};
uiRefs[2].current = heading;
assert.equal(dialog().props.finalFocus(), heading, "Removed trigger falls back to selected day");
const dialogParts = Object.fromEntries(["Root", "Trigger", "Portal", "Backdrop", "Popup", "Title", "Description", "Close"].map((key) => [key, wrap("div")]));
const { TripDialog } = load("src/components/trips/trip-dialog.tsx", {
  "@base-ui/react/dialog": { Dialog: dialogParts },
  "lucide-react": { X: wrap("span") },
  "@/components/ui/button": { Button: wrap("button") },
});
let cancelled = false, changed = false;
const busyDialog = TripDialog({ title: "Activity", description: "Times", busy: true, disablePointerDismissal: true, onOpenChange: () => { changed = true; } });
busyDialog.props.onOpenChange(false, { cancel() { cancelled = true; } });
assert.equal(cancelled, true);
assert.equal(changed, false);
assert.equal(busyDialog.props.disablePointerDismissal, true);
assert.equal(nodes(busyDialog).find((node) => node.type === dialogParts.Close).props.disabled, true);
console.log("Activity dialog date selection, edit/save/cancel, failed saves, dismissal and focus targets passed.");

board().find((node) => node.props.children === "Thu, Oct 1").props.onClick();
boardActivities = [
  { ...activity, ends_at: "2026-10-01T13:50:00Z" },
  { ...activity, id: 3, ends_at: "2026-10-01T02:00:00Z" },
];
board().find((node) => node.props.children === "+ Add activity").props.onClick({ currentTarget: trigger });
const addProps = dialog().props.children.props;
assert.equal(addProps.initialStartsAt, "2026-10-01T13:50:00Z", "Use latest scheduled end regardless of list order");
assert.match(dialog().props.description, /Thu, Oct 1/);
const prefilled = formModule.ActivityForm(addProps);
const startField = nodes(prefilled).find((node) => node.props.label === "Start");
assert.equal(startField.props.hideDate, true);
assert.equal(startField.props.draft.value, "2026-10-01T21:50:00");
assert.equal(nodes(form).find((node) => node.props.label === "Start").props.hideDate, false, "Editing still allows moving to another date");
dialog().props.children.props.onCancel();
boardActivities = [overnight];
board().find((node) => node.props.children === "+ Add activity").props.onClick({ currentTarget: trigger });
assert.equal(dialog().props.children.props.initialStartsAt, undefined, "Do not silently move an addition to the next day");
console.log("Selected-day additions hide the date picker and start at the latest same-day end.");
